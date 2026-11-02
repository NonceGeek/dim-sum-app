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
test("drafts may be incomplete but publication requires usable entry and artwork", () => {
  assert.equal(appDraftSchema.parse({}).name, "");
  assert.ok(publishIssues(EMPTY_DRAFT).includes("launchUrl"));
  const d = {
    ...EMPTY_DRAFT,
    name: "Test",
    authors: "Team",
    summary: "Summary",
    coverUrl: "https://example.org/cover.png",
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
