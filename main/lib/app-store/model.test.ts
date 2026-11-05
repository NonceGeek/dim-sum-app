import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_DRAFT,
  appDraftSchema,
  catalog,
  categoryCode,
  legacyDraft,
  publishIssues,
  safeUrl,
  safeMiniProgramUrl,
  miniProgramTarget,
} from "./model";
import type { StoreApp } from "./model";
test("URL policy rejects scripts, credentials and relative navigation", () => {
  for (const u of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:pass@example.org/",
    "/admin",
  ])
    assert.equal(safeUrl(u), "");
  assert.equal(
    safeUrl("https://example.org/app?q=1"),
    "https://example.org/app?q=1",
  );
});
test("publication allows generated artwork but still requires a usable entry", () => {
  assert.equal(appDraftSchema.parse({}).name, "");
  assert.ok(publishIssues(EMPTY_DRAFT).includes("launchUrl"));
  const d = {
    ...EMPTY_DRAFT,
    name: "Test",
    authors: "Team",
    summary: "Summary",
    coverUrl: "",
    kind: "miniprogram" as const,
    qrUrl: "https://example.org/qr.png",
  };
  assert.deepEqual(publishIssues(d), []);
  assert.ok(
    publishIssues({
      ...d,
      kind: "web",
      launchUrl: "http://example.org",
    }).includes("https"),
  );
});
test("legacy category links map to stable codes", () => {
  assert.equal(categoryCode("Learning"), "learning");
  assert.equal(categoryCode("Gaming"), "game");
  assert.equal(categoryCode("AI"), "ai");
  assert.equal(categoryCode("TOOL"), "other");
  assert.equal(categoryCode("TAG"), "community");
  assert.equal(categoryCode("Others"), "other");
});
test("legacy records do not invent access, login or device claims", () => {
  const a = legacyDraft({
    id: BigInt(1),
    name: "Old",
    description: "Summary",
    authors: ["Author"],
    type: "STUDY",
    url: "https://example.org",
    homepage_url: null,
    github_url: null,
    icon_img: null,
    example_img: null,
    wechat_micro_app: null,
    pinned: false,
    sorting: BigInt(0),
    created_at: new Date(0),
    updated_at: null,
  });
  assert.equal(a.login, "unknown");
  assert.equal(a.access, "unknown");
  assert.equal(a.devices, "unknown");
});
test("search, category, instant and ordering compose without mutating the catalog", () => {
  const one = {
    ...EMPTY_DRAFT,
    id: "1",
    name: "Learn",
    authors: "Team",
    category: "learning",
    access: "direct",
    publishedAt: "2026-01-01",
    updatedAt: "2026-02-01",
    rank: 2,
  } as StoreApp;
  const two = {
    ...one,
    id: "2",
    name: "AI",
    category: "ai",
    access: "request",
    rank: 1,
    updatedAt: "2026-03-01",
  } as StoreApp;
  const all = [one, two];
  assert.deepEqual(
    catalog(all, "team", "learning", true).map((a) => a.id),
    ["1"],
  );
  assert.deepEqual(
    catalog(all, "", "", false, "updated").map((a) => a.id),
    ["2", "1"],
  );
  assert.deepEqual(
    all.map((a) => a.id),
    ["1", "2"],
  );
});

test("mini-program launch protocols reject arbitrary handlers and credentials", () => {
  const scheme = "weixin://dl/business/?t=verified-ticket";
  assert.equal(safeMiniProgramUrl(scheme), scheme);
  assert.equal(
    safeMiniProgramUrl(
      "weixin://dl/business/?appid=wx1234567890abcdef&path=pages/home",
    ),
    "weixin://dl/business/?appid=wx1234567890abcdef&path=pages/home",
  );
  assert.equal(
    safeMiniProgramUrl("https://wxaurl.cn/example"),
    "https://wxaurl.cn/example",
  );
  for (const bad of [
    "javascript:alert(1)",
    "http://example.org",
    "weixin://contacts/",
    "weixin://dl/business/",
    "weixin://user:pass@dl/business/?t=x",
    "weixin://dl.evil/business/?t=x",
    "weixin://dl/business/?appid=invalid",
    "file:///tmp/a",
  ]) {
    assert.equal(safeMiniProgramUrl(bad), "", bad);
    assert.equal(
      appDraftSchema.safeParse({ mobileLaunchUrl: bad }).success,
      false,
    );
  }
  // General website and image fields must never gain custom-protocol support.
  assert.equal(safeUrl(scheme), "");
  assert.equal(appDraftSchema.safeParse({ coverUrl: scheme }).success, false);
});
test("mini-program target follows the device and preserves QR-only legacy defaults", () => {
  const app = {
    ...EMPTY_DRAFT,
    mobileLaunchUrl: "https://wxaurl.cn/mobile",
    desktopLaunchUrl: "weixin://dl/business/?t=desktop",
  };
  for (const ua of ["iPhone", "Android", "iPad", "iPhone MicroMessenger"])
    assert.equal(miniProgramTarget(app, ua), app.mobileLaunchUrl);
  assert.equal(miniProgramTarget(app, "Macintosh", true), app.mobileLaunchUrl);
  for (const ua of ["Macintosh", "Windows NT 10.0", "Linux x86_64"])
    assert.equal(miniProgramTarget(app, ua), app.desktopLaunchUrl);
  assert.equal(
    miniProgramTarget({ ...app, desktopLaunchUrl: "" }, "Windows"),
    "",
  );
  assert.equal(miniProgramTarget(EMPTY_DRAFT, "iPhone"), "");
  assert.equal(appDraftSchema.parse({}).mobileLaunchUrl, "");
  assert.ok(
    publishIssues({ ...app, kind: "miniprogram", qrUrl: "" }).includes("qrUrl"),
  );
});
