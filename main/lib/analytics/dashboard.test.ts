import assert from "node:assert/strict";
import test from "node:test";
import { parseRange } from "./dashboard";

test("dashboard ranges use Beijing calendar days", () => {
  const r = parseRange("2026-10-01", "2026-10-07");
  assert.ok(r);
  assert.equal(r.start.toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-10-07T16:00:00.000Z");
  assert.equal(parseRange("2026-10-07", "2026-10-01"), null);
  assert.equal(parseRange("2025-01-01", "2026-10-01"), null);
  assert.equal(parseRange("bad", "2026-10-01"), null);
});
