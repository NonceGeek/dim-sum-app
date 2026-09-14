import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--pending", "--full"].includes(args[0])) {
    throw new Error("Usage: pnpm exec tsx scripts/sync-wechat-service-followers.ts --pending|--full");
  }
  const { prisma } = await import("../lib/prisma");
  const { WechatServiceClient } = await import("../lib/wechat-service/client");
  const { WechatFollowerStore } = await import("../lib/wechat-service/store");
  const appId = process.env.WECHAT_SERVICE_APPID ?? "";
  const stats: Record<string, number> = {};
  try {
    const client = new WechatServiceClient(appId, process.env.WECHAT_SERVICE_SECRET ?? "");
    const store = new WechatFollowerStore(prisma, appId);
    const full = args[0] === "--full";
    if (full) {
      let cursor = "";
      const seen = new Set<string>();
      do {
        const page = await client.followers(cursor);
        await store.enqueue(page.data?.openid ?? []);
        if (!page.count || !page.next_openid) break;
        if (seen.has(page.next_openid)) throw new Error("WeChat follower pagination repeated a cursor");
        seen.add(page.next_openid);
        cursor = page.next_openid;
      } while (cursor);
      // Also verify previously entered addresses, even if absent from the current list.
      let accountCursor: string | undefined;
      while (true) {
        const accounts = await prisma.account.findMany({
          where: { provider: "wechat", openIdWxService: { not: null } },
          orderBy: { id: "asc" }, take: 500,
          ...(accountCursor ? { cursor: { id: accountCursor }, skip: 1 } : {}),
          select: { id: true, openIdWxService: true },
        });
        if (!accounts.length) break;
        await store.enqueue(accounts.map(a => a.openIdWxService!).filter(Boolean));
        accountCursor = accounts[accounts.length - 1].id;
      }
    }
    let cursor: string | undefined;
    while (true) {
      const rows = await prisma.wechatServiceFollower.findMany({
        where: { appId, ...(full ? {} : { needsSync: true }) },
        orderBy: { id: "asc" }, take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, openId: true },
      });
      if (!rows.length) break;
      for (const row of rows) {
        try {
          const outcome = await store.refresh(row.openId, id => client.userInfo(id));
          stats[outcome] = (stats[outcome] ?? 0) + 1;
        } catch {
          stats.failed = (stats.failed ?? 0) + 1;
          // Full refresh failures must also enter the retry queue.
          await prisma.wechatServiceFollower.update({ where: { id: row.id }, data: { needsSync: true } });
        }
      }
      cursor = rows[rows.length - 1].id;
    }
    console.log(JSON.stringify(stats));
    if (stats.failed) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("WeChat follower sync failed; check configuration, database and API permissions."); process.exitCode = 1; });
