import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { loadOrCreateDaily } from "./daily-entry-store";
import { getEntry } from "./service";

// Explicit opt-in: uses a temporary future date and deletes only that test row.
test("database: concurrent initializers persist one complete, eligible daily snapshot", {
  skip: process.env.RUN_SEARCH_DAILY_DB_TESTS !== "1",
}, async () => {
  const day = new Date(Date.UTC(2200, 0, 1) + Math.floor(Math.random() * 30000) * 86400000);
  const date = day.toISOString().slice(0, 10);
  const window = { date, expiresAt: new Date(day.getTime() + 57600000).toISOString() };
  const before = await prisma.$queryRaw<Array<{ date: Date }>>`SELECT date FROM search_daily_entries WHERE date=${date}::date`;
  assert.equal(before.length, 0, "refuse to reuse an existing date");
  let createdId: string | undefined;
  try {
    const init = () => prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
      await tx.$executeRaw`SET LOCAL jit=off`;
      return loadOrCreateDaily(tx, window);
    }, { maxWait: 20000, timeout: 20000 });
    const first = await init(); createdId = first.entryId;
    // Remove only the test row so all following callers exercise first creation.
    await prisma.$executeRaw`DELETE FROM search_daily_entries WHERE date=${date}::date AND entry_id=${createdId}::uuid`;
    const results = await Promise.allSettled(Array.from({ length: 4 }, init));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      assert.deepEqual(result.value, first);
    }
    assert.deepEqual(await init(), first, "later callers retain the snapshot");
    assert.deepEqual(await getEntry(first.entryId), first.entry, "entry obeys Search public eligibility and full contract");
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM search_daily_entries WHERE date=${date}::date`;
    assert.equal(rows[0].count, 1);
    const rls = await prisma.$queryRaw<Array<{ enabled: boolean; policies: number }>>`SELECT relrowsecurity AS enabled,(SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='search_daily_entries') AS policies FROM pg_class WHERE oid='public.search_daily_entries'::regclass`;
    assert.equal(rls[0].enabled, true); assert.equal(rls[0].policies, 0);
  } finally {
    if (createdId) await prisma.$executeRaw`DELETE FROM search_daily_entries WHERE date=${date}::date AND entry_id=${createdId}::uuid`;
    await prisma.$disconnect();
  }
});
