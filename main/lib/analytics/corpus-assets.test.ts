import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, formatDuration, measureState, toCsv } from "./corpus-assets-format";
import { foldMedia } from "./corpus-assets";

const units = { h: "h", m: "min", s: "s" };

test("durations render as hours / minutes / seconds", () => {
  assert.equal(formatDuration(0, units), "0 s");
  assert.equal(formatDuration(59.6, units), "1 min 0 s");
  assert.equal(formatDuration(623.4, units), "10 min 23 s");
  assert.equal(formatDuration(3 * 3600 + 7 * 60 + 5, units), "3 h 7 min");
});

test("sizes auto-scale to MB / GB / TB", () => {
  assert.equal(formatBytes(54_982_700), "52.4 MB");
  assert.equal(formatBytes(936_113), "914 KB");
  assert.equal(formatBytes(3 * 1024 ** 3), "3.00 GB");
  assert.equal(formatBytes(1.5 * 1024 ** 4), "1.50 TB");
});

test("unmeasured values are pending, never zero", () => {
  assert.equal(measureState({ value: 0, missing: 0 }, 0), "empty");
  assert.equal(measureState({ value: 0, missing: 5 }, 5), "pending");
  assert.equal(measureState({ value: 120, missing: 2 }, 5), "partial");
  assert.equal(measureState({ value: 120, missing: 0 }, 5), "complete");
});

test("media rows fold per kind and keep missing counts", () => {
  const m = foldMedia([
    { kind: "audio", n: 3, duration: 90, duration_missing: 1, bytes: 3000, size_missing: 1, probed: 2 },
    { kind: "video", n: 1, duration: 0, duration_missing: 1, bytes: 0, size_missing: 1, probed: 0 },
    { kind: "image", n: 2, duration: 0, duration_missing: 2, bytes: 500, size_missing: 0, probed: 2 },
  ]);
  assert.equal(m.by.audio.count, 3);
  assert.deepEqual(m.by.audio.duration, { value: 90, missing: 1 });
  assert.equal(m.by.model3d.count, 0);
  assert.deepEqual(m.size, { value: 3500, missing: 2 });
  assert.equal(m.resources, 6);
  assert.equal(m.probed, 4);
});

test("csv escapes and starts with a BOM", () => {
  assert.equal(toCsv(["a", "b"], [["x,y", 'q"t']]), '﻿a,b\r\n"x,y","q""t"');
});
