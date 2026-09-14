import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { bindingDecision, WechatFollowerStore } from "./store";
test("ambiguous identities and existing addresses are not overwritten", () => {
  assert.equal(bindingDecision([], "o"), "unmatched");
  assert.equal(bindingDecision([{ userId: "a", openIdWxService: null }, { userId: "b", openIdWxService: null }], "o"), "conflict");
  assert.equal(bindingDecision([{ userId: "a", openIdWxService: "different" }], "o"), "conflict");
  assert.equal(bindingDecision([{ userId: "a", openIdWxService: "o" }, { userId: "a", openIdWxService: null }], "o"), "bind");
});
// Explicit disposable database only; never falls back to DATABASE_URL.
test("database: follow/login, unsubscribe, retries, conflicts and network race", { skip: !process.env.WECHAT_TEST_DATABASE_URL }, async () => {
  const db = new PrismaClient({ datasourceUrl: process.env.WECHAT_TEST_DATABASE_URL });
  const appId = `test-${Date.now()}`;
  const store = new WechatFollowerStore(db, appId);
  const ids: string[] = [];
  async function account(unionId: string, userId: string) {
    const row = await db.account.create({ data: { type: "oauth", provider: "wechat", providerAccountId: `${appId}-${userId}`, unionId, userId } });
    ids.push(row.id); return row;
  }
  const unionId = `${appId}-union`, openId = `${appId}-openid`, userId = `${appId}-user`;
  try {
    await db.$executeRaw`INSERT INTO "User" (id) VALUES (${userId})`;
    await db.$executeRaw`INSERT INTO "User" (id) VALUES (${`${userId}-other`})`;
    await store.recordEvent({ openId, eventTime: 100, subscribed: true });
    assert.equal(await store.refresh(openId, async () => ({ openid: openId, subscribe: 1, unionid: unionId })), "unmatched");
    const row = await account(unionId, userId);
    assert.equal(await store.bindUnionId(unionId), "bound");
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: row.id } })).openIdWxService, openId);
    await store.recordEvent({ openId, eventTime: 200, subscribed: false });
    await store.recordEvent({ openId, eventTime: 100, subscribed: true });
    await store.recordEvent({ openId, eventTime: 200, subscribed: true });
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: row.id } })).openIdWxService, null);
    assert.equal(await store.bindUnionId(unionId), "unmatched");
    await store.recordEvent({ openId, eventTime: 300, subscribed: true });
    assert.equal(await store.refresh(openId, async () => {
      await store.recordEvent({ openId, eventTime: 400, subscribed: false });
      return { openid: openId, subscribe: 1, unionid: unionId };
    }), "stale");
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: row.id } })).openIdWxService, null);
    await store.recordEvent({ openId, eventTime: 500, subscribed: true });
    await assert.rejects(store.refresh(openId, async () => { throw new Error("network failure"); }));
    assert.equal((await db.wechatServiceFollower.findUniqueOrThrow({ where: { appId_openId: { appId, openId } } })).needsSync, true);
    await account(unionId, `${userId}-other`);
    assert.equal(await store.refresh(openId, async () => ({ openid: openId, subscribe: 1, unionid: unionId })), "conflict");
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: row.id } })).openIdWxService, null);
    await store.enqueue([`${openId}-missing-union`]);
    assert.equal(await store.refresh(`${openId}-missing-union`, async id => ({ openid: id, subscribe: 1 })), "missing_unionid");
  } finally {
    await db.account.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: [userId, `${userId}-other`] } } });
    await db.wechatServiceFollower.deleteMany({ where: { appId } });
    await db.$disconnect();
  }
});
