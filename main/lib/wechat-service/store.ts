import { Prisma, PrismaClient } from "@prisma/client";
import type { FollowerInfo } from "./client";

type Tx = Prisma.TransactionClient;
export type BindingResult = "bound" | "unmatched" | "missing_unionid" | "conflict" | "unsubscribed" | "stale";

export function bindingDecision(accounts: { userId: string; openIdWxService: string | null }[], openId: string): "bind" | "unmatched" | "conflict" {
  if (!accounts.length) return "unmatched";
  if (new Set(accounts.map(a => a.userId)).size !== 1 || accounts.some(a => a.openIdWxService && a.openIdWxService !== openId)) return "conflict";
  return "bind";
}

export class WechatFollowerStore {
  constructor(private db: PrismaClient, readonly appId: string) {
    if (!appId) throw new Error("Missing service account AppID");
  }
  private async transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
        throw error;
      }
    }
  }
  private key(openId: string) { return { appId_openId: { appId: this.appId, openId } }; }
  async recordEvent(event: { openId: string; eventTime: number; subscribed: boolean }) {
    return this.transaction(async tx => {
      const current = await tx.wechatServiceFollower.findUnique({ where: this.key(event.openId) });
      // Duplicate/older events cannot restore an address cleared by unsubscribe.
      if (current && (current.eventTime > event.eventTime ||
        (current.eventTime === event.eventTime && (!current.subscribed || event.subscribed)))) return;
      await tx.wechatServiceFollower.upsert({
        where: this.key(event.openId),
        create: { appId: this.appId, ...event, needsSync: event.subscribed, version: 1 },
        update: { subscribed: event.subscribed, eventTime: event.eventTime, needsSync: event.subscribed, version: { increment: 1 } },
      });
      if (!event.subscribed) await tx.account.updateMany({
        where: { provider: "wechat", openIdWxService: event.openId }, data: { openIdWxService: null },
      });
    });
  }
  async enqueue(openIds: string[]) {
    if (!openIds.length) return;
    // Existing records retain their event state/version; the worker verifies with WeChat.
    await this.db.wechatServiceFollower.createMany({
      data: [...new Set(openIds)].map(openId => ({ appId: this.appId, openId })), skipDuplicates: true,
    });
  }
  private async bind(tx: Tx, follower: { openId: string; unionId: string | null; subscribed: boolean }): Promise<BindingResult> {
    if (!follower.subscribed) return "unsubscribed";
    if (!follower.unionId) return "missing_unionid";
    const siblings = await tx.wechatServiceFollower.count({ where: { appId: this.appId, unionId: follower.unionId, subscribed: true } });
    if (siblings !== 1) return "conflict";
    const accounts = await tx.account.findMany({ where: { provider: "wechat", unionId: follower.unionId } });
    const decision = bindingDecision(accounts, follower.openId);
    if (decision !== "bind") return decision;
    const otherOwner = await tx.account.count({ where: { openIdWxService: follower.openId, userId: { not: accounts[0].userId } } });
    if (otherOwner) return "conflict";
    await tx.account.updateMany({
      where: { id: { in: accounts.map(a => a.id) } }, data: { openIdWxService: follower.openId },
    });
    return "bound";
  }
  async bindUnionId(unionId: string): Promise<BindingResult> {
    return this.transaction(async tx => {
      const followers = await tx.wechatServiceFollower.findMany({ where: { appId: this.appId, unionId, subscribed: true, needsSync: false, syncedAt: { not: null } } });
      if (!followers.length) return "unmatched";
      if (followers.length !== 1) return "conflict";
      return this.bind(tx, followers[0]);
    });
  }
  async refresh(openId: string, lookup: (openId: string) => Promise<FollowerInfo>): Promise<BindingResult> {
    const snapshot = await this.db.wechatServiceFollower.findUniqueOrThrow({ where: this.key(openId) });
    const info = await lookup(openId);
    if (info.openid !== openId) throw new Error("Mismatched follower information");
    return this.transaction(async tx => {
      const current = await tx.wechatServiceFollower.findUniqueOrThrow({ where: this.key(openId) });
      if (current.version !== snapshot.version) return "stale";
      const follower = await tx.wechatServiceFollower.update({
        where: this.key(openId), data: {
          subscribed: info.subscribe === 1, unionId: info.unionid ?? current.unionId,
          syncedAt: new Date(), needsSync: false, version: { increment: 1 },
        },
      });
      if (!follower.subscribed) {
        await tx.account.updateMany({ where: { provider: "wechat", openIdWxService: openId }, data: { openIdWxService: null } });
        return "unsubscribed";
      }
      return this.bind(tx, follower);
    });
  }
}
