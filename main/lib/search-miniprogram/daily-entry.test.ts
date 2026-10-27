import assert from "node:assert/strict";
import test from "node:test";
import { dailyWindow, resolveDailyEntry, type DailyEntry, type DailyRepository } from "./daily-entry";
const entry: DailyEntry = {
  id: "550e8400-e29b-41d4-a716-446655440001", expression: "唔该",
  senses: [{ meaning: "谢谢", jyutping: "m4 goi1", audio: null, usageNotes: null, examples: [] }],
  source: { datasetSlug: "test", datasetName: "测试", licenses: [] }, available: true,
};
const fixed = (value: string) => () => new Date(value);
const repository = (available = true): DailyRepository => ({
  async getOrCreate() { return { entryId: entry.id, entry: structuredClone(entry) }; },
  async isAvailable() { return available; },
});

test("Beijing dates and expiry change at UTC 16:00, including year/leap boundaries", () => {
  assert.deepEqual(dailyWindow(new Date("2026-10-27T15:59:59.999Z")), { date: "2026-10-27", expiresAt: "2026-10-27T16:00:00.000Z" });
  assert.equal(dailyWindow(new Date("2026-10-27T16:00:00Z")).date, "2026-10-28");
  assert.equal(dailyWindow(new Date("2026-12-31T16:00:00Z")).date, "2027-01-01");
  assert.equal(dailyWindow(new Date("2028-02-28T16:00:00Z")).expiresAt, "2028-02-29T16:00:00.000Z");
});
test("same product day returns the saved complete entry independently of request time", async () => {
  const a = await resolveDailyEntry(repository(), fixed("2026-10-27T00:00:00Z"));
  const b = await resolveDailyEntry(repository(), fixed("2026-10-27T15:59:59Z"));
  assert.deepEqual(a.entry, b.entry); assert.equal(a.date, b.date); assert.equal(a.expiresAt, b.expiresAt);
  assert.equal(a.timeZone, "Asia/Shanghai"); assert.notEqual(a.serverTime, b.serverTime);
});
test("withdrawal fails closed without replacing the day's chosen entry", async () => {
  let reads = 0;
  const repo = repository(false); const read = repo.getOrCreate;
  repo.getOrCreate = async (window) => { reads++; return read(window); };
  await assert.rejects(resolveDailyEntry(repo, fixed("2026-10-27T00:00:00Z")), (e: any) => e.status === 404 && e.code === "DAILY_ENTRY_UNAVAILABLE");
  assert.equal(reads, 1);
});
test("midnight crossed while fetching retries for the new server date", async () => {
  const dates: string[] = []; let tick = 0;
  const repo = repository(); repo.getOrCreate = async (window) => { dates.push(window.date); return { entryId: entry.id, entry }; };
  const result = await resolveDailyEntry(repo, () => new Date(tick++ ? "2026-10-27T16:00:01Z" : "2026-10-27T15:59:59Z"));
  assert.deepEqual(dates, ["2026-10-27", "2026-10-28"]); assert.equal(result.date, "2026-10-28");
});
test("invalid snapshots or mismatched IDs never expose extra/raw fields", async () => {
  for (const value of [{ ...entry, rawNote: "private" }, { ...entry, id: "550e8400-e29b-41d4-a716-446655440002" }, { ...entry, senses: [] }]) {
    const repo = repository(); repo.getOrCreate = async () => ({ entryId: entry.id, entry: value });
    await assert.rejects(resolveDailyEntry(repo, fixed("2026-10-27T00:00:00Z")), (e: any) => e.status === 503);
  }
});


test("daily route rejects all client date/entry overrides without requiring authentication", async () => {
  const { NextRequest } = await import("next/server");
  const { GET } = await import("../../app/api/miniprogram/search/daily-entry/route");
  for (const query of ["?date=2026-01-01", "?entryId=anything", "?q=test", "?x="]) {
    for (const token of [undefined, "invalid-token"]) {
      const response = await GET(new NextRequest(`https://example.com/api/miniprogram/search/daily-entry${query}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined));
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal((await response.json()).error.code, "INVALID_DAILY_REQUEST");
    }
  }
});
