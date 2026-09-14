import { test } from "node:test";
import assert from "node:assert/strict";
import { WechatServiceClient } from "./client";
function clientWith(responses: unknown[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new WechatServiceClient("app", "secret", (async (url, init) => {
    calls.push({ url: String(url), init }); return Response.json(responses.shift());
  }) as typeof fetch);
  return { client, calls };
}
const token = { access_token: "test-token", expires_in: 7200 };
test("stable token is non-forced, cached; follower pagination", async () => {
  const { client, calls } = clientWith([token, { count: 1, data: { openid: ["o1"] }, next_openid: "o1" }, { count: 0, next_openid: "" }]);
  assert.equal((await client.followers()).count, 1);
  assert.equal((await client.followers("o1")).count, 0);
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[0].init!.body as string).force_refresh, false);
  assert.equal(new URL(calls[2].url).searchParams.get("next_openid"), "o1");
});
test("expired token retries once; API errors and wrong identities fail closed", async () => {
  const { client } = clientWith([token, { errcode: 42001 }, token, { openid: "o1", subscribe: 1, unionid: "u1" }]);
  assert.equal((await client.userInfo("o1")).unionid, "u1");
  await assert.rejects(clientWith([token, { openid: "other", subscribe: 1 }]).client.userInfo("o1"));
  await assert.rejects(clientWith([token, { errcode: 48001, errmsg: "private details" }]).client.userInfo("o1"), /WeChat API 48001/);
  await assert.rejects(clientWith([token, { count: 2, data: { openid: ["o1"] } }]).client.followers());
});
