import assert from "node:assert/strict";
import test from "node:test";
import { createSerialWriter } from "./probe-writer";

test("16 probe workers never compete for DB connections, including timeout retries", async () => {
  const write = createSerialWriter(async () => {});
  let active = 0;
  let peak = 0;
  let retries = 0;
  const values = await Promise.all(Array.from({ length: 16 }, (_, i) => {
    let attempts = 0;
    return write(async () => {
      active++;
      peak = Math.max(peak, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (i === 0 && attempts++ === 0) {
          retries++;
          throw Object.assign(new Error("pool timeout"), { code: "P2024" });
        }
        return i;
      } finally { active--; }
    });
  }));
  assert.equal(peak, 1);
  assert.equal(retries, 1);
  assert.deepEqual(values, Array.from({ length: 16 }, (_, i) => i));
});

test("retries are bounded and permanent failures do not poison queued writes", async () => {
  const write = createSerialWriter(async () => {});
  let attempts = 0;
  await assert.rejects(write(async () => {
    attempts++;
    throw Object.assign(new Error("pool timeout"), { code: "P2024" });
  }), /pool timeout/);
  assert.equal(attempts, 5);
  attempts = 0;
  await assert.rejects(write(async () => { attempts++; throw new Error("bad data"); }), /bad data/);
  assert.equal(attempts, 1);
  assert.equal(await write(async () => 42), 42);
});
