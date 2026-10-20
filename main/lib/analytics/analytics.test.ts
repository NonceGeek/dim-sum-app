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
import { parseRange } from "./dashboard";

test("unknown events and invalid payloads are dropped", () => {
  assert.equal(parseClientEvent("delete_everything", {}), null);
  assert.equal(parseClientEvent("search_result_click", { query: "x", section: "nope", entryId: "a", position: 0 }), null);
  assert.deepEqual(parseClientEvent("share_link_copy", { entryId: "abc", extra: "dropped" }), { entryId: "abc" });
  assert.deepEqual(parseClientEvent("page_view", { landing: true }), { landing: true });
});

test("rows split indexed columns from properties and normalize queries", () => {
  const row = toRow(
    "search_section_impression",
    { query: "  Dim   SUM ", section: "similar", resultCount: 3, mediaType: "video", page: 0 },
    { source: "web" },
  );
  assert.equal(row.query, "dim sum");
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
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPhone) Mobile Safari"), "mobile");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPad) Safari"), "tablet");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Macintosh) Chrome"), "desktop");
  assert.equal(referrerHost("https://www.google.com/search?q=x", "search.aidimsum.com"), "google.com");
  assert.equal(referrerHost("https://search.aidimsum.com/library", "search.aidimsum.com"), "(internal)");
  assert.equal(referrerHost("not a url"), null);
});

test("ingest batches are bounded", () => {
  const event = { name: "page_view", props: {} };
  const base = {
    anonymousId: "6f1c3d9a-1b2c-4d5e-8f90-123456789abc",
    sessionId: "7f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  };
  assert.equal(ingestBatchSchema.safeParse({ ...base, events: [event] }).success, true);
  assert.equal(ingestBatchSchema.safeParse({ ...base, events: Array(21).fill(event) }).success, false);
  assert.equal(ingestBatchSchema.safeParse({ ...base, anonymousId: "x", events: [event] }).success, false);
});

test("dashboard ranges use Beijing calendar days", () => {
  const r = parseRange("2026-10-01", "2026-10-07");
  assert.ok(r);
  assert.equal(r.start.toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-10-07T16:00:00.000Z");
  assert.equal(parseRange("2026-10-07", "2026-10-01"), null);
  assert.equal(parseRange("2025-01-01", "2026-10-01"), null);
  assert.equal(parseRange("bad", "2026-10-01"), null);
});
