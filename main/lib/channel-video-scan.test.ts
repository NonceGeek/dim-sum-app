import test from "node:test";
import assert from "node:assert/strict";
import { createChannelScene, channelSceneId, verifyChannelScene } from "./channel-video-scan";
import { generateChannelCode, CHANNEL_SCAN_PAGE } from "./wechat-channel-code";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { parseChannelVideo } from "./channel-video";

const video = { finderUserName: "sphExample", feedId: "export/longFeedId" };
const secret = "test-secret";
test("scene fits WeChat limit, preserves 64-bit IDs and invalidates changed bindings", () => {
  for (const id of [BigInt(1), BigInt("9223372036854775807")]) {
    const scene = createChannelScene(id, video, secret);
    assert.ok(scene.length <= 32);
    assert.equal(channelSceneId(scene), id);
    assert.ok(verifyChannelScene(scene, video, secret));
    assert.equal(verifyChannelScene(scene, { ...video, feedId: "other" }, secret), false);
    assert.equal(verifyChannelScene(scene, { ...video, finderUserName: "other" }, secret), false);
    assert.equal(verifyChannelScene(scene, video, "other-secret"), false);
  }
  for (const invalid of ["", "0.1234567890123456", "01.1234567890123456", "zzzzzzzzzzzzz.1234567890123456", "1.invalid", "https://example.com"]) assert.equal(channelSceneId(invalid), null);
});

function loadRoute(path: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Buffer, Error, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return module.exports;
}

test("public resolver needs no auth and returns only IDs; changed, removed and forged bindings fail", async () => {
  let row: any = { channel_video: video, title: "private title", user_id: "private author" };
  let calls = 0;
  const route = loadRoute("app/api/miniprogram/corpus_collection/channel-video/resolve/route.ts", {
    "next/server": { NextResponse },
    "@/lib/prisma": { prisma: { corpus_collection_submissions: { findUnique: async (query: any) => {
      calls++;
      assert.equal(JSON.stringify(query.select), '{"channel_video":true}');
      return row;
    } } } },
    "@/lib/channel-video": { parseChannelVideo },
    "@/lib/channel-video-scan": { channelSceneId, verifyChannelScene },
    "@/lib/wechat-channel-code": { channelWechatConfig: () => ({ secret }) },
  });
  const scene = createChannelScene(BigInt(1), video, secret);
  const resolve = (code = scene) => route.GET(new NextRequest(`https://example.com?scene=${code}`));
  let response = await resolve();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { channelVideo: video });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  row = { channel_video: { ...video, feedId: "changed" } };
  assert.equal((await resolve()).status, 404);
  row = { channel_video: null };
  assert.equal((await resolve()).status, 404);
  row = null;
  assert.equal((await resolve()).status, 404);
  row = { channel_video: video };
  assert.equal((await resolve(scene.slice(0, -1) + (scene.endsWith("a") ? "b" : "a"))).status, 404);
  const before = calls;
  assert.equal((await resolve("bad")).status, 404);
  assert.equal(calls, before);
});

test("code generation checks existing admin scope before contacting WeChat", async () => {
  let allowed = false;
  let found = false;
  let generationCalls = 0;
  const route = loadRoute("app/api/admin/corpus-collection/submissions/[id]/channel-code/route.ts", {
    "next/server": { NextResponse },
    "@/lib/app-route-context": { getStringRouteParam: async () => "1" },
    "@/lib/services/submission-access": {
      withSubmissionAccess: async (_req: any, handler: any) => allowed ? handler({}) : NextResponse.json({}, { status: 403 }),
      submissionScope: () => ({ activity_id: { in: [BigInt(10)] } }),
    },
    "@/lib/services/corpus-collection": { parseBigIntId: (id: string) => BigInt(id) },
    "@/lib/prisma": { prisma: { corpus_collection_submissions: { findFirst: async (query: any) => {
      assert.deepEqual([...query.where.activity_id.in], [BigInt(10)]);
      return found ? { channel_video: video } : null;
    } } } },
    "@/lib/channel-video": { parseChannelVideo },
    "@/lib/channel-video-scan": { createChannelScene },
    "@/lib/wechat-channel-code": {
      channelWechatConfig: () => ({ secret }), CHANNEL_CODE_ENVIRONMENTS: ["release", "trial", "develop"],
      generateChannelCode: async () => { generationCalls++; return { bytes: Buffer.from("image"), contentType: "image/png" }; },
    },
  });
  const request = new NextRequest("https://example.com?env=trial", { method: "POST" });
  assert.equal((await route.POST(request, {})).status, 403);
  allowed = true;
  assert.equal((await route.POST(request, {})).status, 404);
  assert.equal(generationCalls, 0);
  found = true;
  assert.equal((await route.POST(new NextRequest("https://example.com?env=bad"), {})).status, 400);
  const response = await route.POST(request, {});
  assert.equal(response.status, 200);
  assert.equal(generationCalls, 1);
});

test("WeChat code request uses correct page/environment and retries expired credentials once", async () => {
  const oldFetch = globalThis.fetch;
  const oldApp = process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID;
  const oldSecret = process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET;
  process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID = "test-app";
  process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET = secret;
  const calls: any[] = [];
  let codes = 0;
  globalThis.fetch = (async (url: any, options: any) => {
    const body = JSON.parse(options.body); calls.push({ url, body });
    if (String(url).includes("stable_token")) return Response.json({ access_token: "token", expires_in: 7200 });
    codes++;
    if (codes === 1) return Response.json({ errcode: 42001 });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  try {
    const scene = createChannelScene(BigInt(1), video, secret);
    assert.deepEqual(await generateChannelCode(scene, "trial"), { bytes: Buffer.from([1, 2, 3]), contentType: "image/png" });
    assert.equal(calls.length, 4);
    assert.equal(calls[2].body.force_refresh, true);
    assert.deepEqual(calls[1].body, { scene, page: CHANNEL_SCAN_PAGE, env_version: "trial", check_path: false, width: 430 });
    await generateChannelCode(scene, "release");
    assert.equal(calls.at(-1).body.check_path, true);
    globalThis.fetch = (async () => Response.json({ errcode: 41030 })) as typeof fetch;
    await assert.rejects(generateChannelCode(scene, "release"), /扫码页面尚未发布/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldApp === undefined) delete process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID; else process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID = oldApp;
    if (oldSecret === undefined) delete process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET; else process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET = oldSecret;
  }
});
