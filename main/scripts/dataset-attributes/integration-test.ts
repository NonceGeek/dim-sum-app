import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ActivityCreationConflict, createActivityWithDataset } from "../../lib/dataset-management";

const url = process.env.DATASET_TEST_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith("/dimsum_dataset_test")) {
  throw new Error("Use a dedicated local dimsum_dataset_test database");
}
async function main() {
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  if (process.argv.includes("--after-contract")) {
    const columns = await db.$queryRaw<Array<{ count: bigint }>>`select count(*) from information_schema.columns where table_schema='public' and table_name='cantonese_corpus_all' and column_name='content_attribute'`;
    assert.equal(Number(columns[0].count), 0);
  } else {
    assert.equal((await db.cantonese_categories.findUniqueOrThrow({ where: { name: "oral-source" } })).content_attribute, "oral");
  }
  assert.equal((await db.cantonese_categories.findUniqueOrThrow({ where: { name: "mixed-source" } })).content_attribute, "unclassified");
  const legacy = await db.corpus_collection_activities.findFirstOrThrow({ where: { title: "Legacy activity" }, include: { dataset: true } });
  assert.equal(legacy.dataset?.content_attribute, "unclassified");

  const key = randomUUID();
  const payload = { title: "New activity", slug: `test-${key}`, created_by: "test-admin" };
  const results = await Promise.all(Array.from({ length: 3 }, () => createActivityWithDataset(db, payload, "oral", key)));
  assert.equal(new Set(results.map((r) => r.activity.id)).size, 1);
  assert.equal(results.filter((r) => !r.replayed).length, 1);
  assert.equal(await db.cantonese_categories.count({ where: { name: `activity-${key}` } }), 1);
  assert.equal(results[0].activity.dataset?.content_attribute, "oral");
  await assert.rejects(createActivityWithDataset(db, { ...payload, title: "Different payload" }, "oral", key), ActivityCreationConflict);

  const before = await db.cantonese_categories.count();
  await assert.rejects(createActivityWithDataset(db, payload, "cultural_knowledge", randomUUID())); // duplicate slug after dataset insert
  assert.equal(await db.cantonese_categories.count(), before, "failed activity rolls back its dataset");
  await assert.rejects(db.cantonese_categories.delete({ where: { name: results[0].activity.dataset_name! } }));

  await db.cantonese_categories.update({ where: { name: "oral-source" }, data: { nickname: "New alias", content_attribute: "cultural_knowledge" } });
  const inherited = await db.$queryRaw<Array<{ content_attribute: string }>>`
    select ds.content_attribute from cantonese_corpus_all c
    join cantonese_categories ds on ds.name=c.category where c.category='oral-source'`;
  assert.deepEqual(inherited.map((r) => r.content_attribute), ["cultural_knowledge", "cultural_knowledge"]);
  console.log("PASS: backfill, ambiguous sources, concurrent retries, payload conflict, rollback, dataset protection, inherited attributes");
} finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
