import assert from "node:assert/strict";
import test from "node:test";
import {
  deviceFromUserAgent,
  ingestBatchSchema,
  isBotUserAgent,
  normalizeQuery,
  parseClientEvent,
  referrerHost,
} from "./events";
import { toRow } from "./server";

test("unknown events and invalid payloads are dropped", () => {
  assert.equal(parseClientEvent("delete_everything", {}), null);
  assert.equal(parseClientEvent("search_result_click", { query: "x", section: "nope", entryId: "a", position: 0 }), null);
  const shareId = "6f1c3d9a-1b2c-4d5e-8f90-123456789abc";
  assert.deepEqual(
    parseClientEvent("share_link_copy", { entryId: "abc", shareId, copyEntry: "share_card", extra: "dropped" }),
    { entryId: "abc", shareId, copyEntry: "share_card" },
  );
  // #508: copy without share_id / copy_entry is rejected.
  assert.equal(parseClientEvent("share_link_copy", { entryId: "abc" }), null);
  assert.deepEqual(parseClientEvent("page_view", { landing: true }), { landing: true });
});

test("miniprogram events: scene, surfaces and forwarding", () => {
  assert.deepEqual(parseClientEvent("page_view", { landing: true, scene: 1007 }), { landing: true, scene: 1007 });
  assert.equal(parseClientEvent("page_view", { scene: -1 }), null);
  const playSessionId = "7f1c3d9a-1b2c-4d5e-8f90-123456789abc";
  const shareId = "8f1c3d9a-1b2c-4d5e-8f90-123456789abc";
  assert.deepEqual(
    parseClientEvent("video_play", { entryId: "e1", videoId: "v1", playSessionId, surface: "miniprogram" }),
    { entryId: "e1", videoId: "v1", playSessionId, surface: "miniprogram" },
  );
  assert.deepEqual(
    parseClientEvent("share_card_open", { entryId: "e1", shareId, surface: "miniprogram" }),
    { entryId: "e1", shareId, surface: "miniprogram" },
  );
  assert.deepEqual(parseClientEvent("mp_share", { channel: "timeline" }), { channel: "timeline" });
});

test("#508 video failure and share landing parameters", () => {
  const ids = {
    playSessionId: "7f1c3d9a-1b2c-4d5e-8f90-123456789abc",
    loadAttemptId: "9f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  };
  const failure = {
    entryId: "e1", videoId: "/v.mp4", ...ids, errorType: "timeout", loadElapsedMs: 15000,
    fallbackType: "text_audio", surface: "search_tile", query: "食饭", section: "similar",
  };
  assert.deepEqual(parseClientEvent("video_load_failed", failure), failure);
  assert.equal(parseClientEvent("video_load_failed", { ...failure, errorType: "aborted" }), null);
  assert.equal(parseClientEvent("video_load_failed", { ...failure, fallbackType: undefined }), null);
  const open = {
    entryId: "e1",
    shareId: "8f1c3d9a-1b2c-4d5e-8f90-123456789abc",
    landingVisitId: "af1c3d9a-1b2c-4d5e-8f90-123456789abc",
    sourceChannel: "shared_link",
  };
  assert.deepEqual(parseClientEvent("share_link_open", open), open);
  assert.equal(parseClientEvent("share_link_open", { entryId: "e1" }), null);
  assert.equal(parseClientEvent("mp_share", { channel: "email" }), null);
});

test("rows split indexed columns from properties and normalize queries", () => {
  const row = toRow(
    "search_section_impression",
    { query: "  Dim   SUM ", section: "similar", resultCount: 3, mediaType: "video", page: 0 },
    { source: "web" },
  );
  // #508 search_keyword: trimmed only, original spacing and case kept.
  assert.equal(row.query, "Dim   SUM");
  assert.equal(row.section, "similar");
  assert.equal(row.media_type, "video");
  assert.deepEqual(row.properties, { resultCount: 3, page: 0 });
  assert.equal(normalizeQuery("   "), null);
  assert.equal(normalizeQuery("a".repeat(150))?.length, 100);
});

test("bots, devices and referrers", () => {
  assert.equal(isBotUserAgent(null), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 HeadlessChrome/120"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari"), false);
  // WeChat miniprogram wx.request user agent.
  assert.equal(
    isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50 miniProgram/wx1234"),
    false,
  );
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPhone) Mobile Safari"), "mobile");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPad) Safari"), "tablet");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Macintosh) Chrome"), "desktop");
  assert.equal(referrerHost("https://www.google.com/search?q=x", "search.aidimsum.com"), "google.com");
  assert.equal(referrerHost("https://search.aidimsum.com/library", "search.aidimsum.com"), "(internal)");
  assert.equal(referrerHost("not a url"), null);
});

test("ingest batches are bounded and accept the miniprogram source", () => {
  const event = { name: "page_view", props: {} };
  const base = {
    anonymousId: "6f1c3d9a-1b2c-4d5e-8f90-123456789abc",
    sessionId: "7f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  };
  assert.equal(ingestBatchSchema.safeParse({ ...base, events: [event] }).success, true);
  assert.equal(ingestBatchSchema.safeParse({ ...base, source: "miniprogram", events: [event] }).success, true);
  assert.equal(ingestBatchSchema.safeParse({ ...base, source: "app", events: [event] }).success, false);
  assert.equal(ingestBatchSchema.safeParse({ ...base, events: Array(21).fill(event) }).success, false);
  assert.equal(ingestBatchSchema.safeParse({ ...base, anonymousId: "x", events: [event] }).success, false);
});
