import assert from "node:assert/strict";
import test from "node:test";
import {
  activityDateTimeToISOString,
  formatActivityDateTime,
  parseActivityDateTime,
} from "./activity-time";

test("interprets datetime-local values as Asia/Shanghai wall-clock time", () => {
  assert.equal(activityDateTimeToISOString("2026-09-01T09:00"), "2026-09-01T01:00:00.000Z");
});

test("accepts timestamps with an explicit timezone", () => {
  assert.equal(parseActivityDateTime("2026-09-01T01:00:00Z")?.toISOString(), "2026-09-01T01:00:00.000Z");
  assert.equal(parseActivityDateTime("2026-09-01T09:00:00+08:00")?.toISOString(), "2026-09-01T01:00:00.000Z");
});

test("rejects ambiguous and invalid timestamps", () => {
  assert.throws(() => parseActivityDateTime("September 1, 2026 09:00"));
  assert.throws(() => parseActivityDateTime("2026-02-30T09:00"));
});

test("formats activity timestamps in Asia/Shanghai", () => {
  const formatted = formatActivityDateTime("2026-09-01T01:00:00.000Z", "zh-CN");
  assert.match(formatted, /2026/);
  assert.match(formatted, /09:00/);
  assert.match(formatted, /(?:GMT\+8|UTC\+8)/);
});
