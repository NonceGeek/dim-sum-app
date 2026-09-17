import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.PUBLIC_CORPUS_TEST_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.startsWith("/dimsum_public_corpus_test")) {
  throw new Error("Use a dedicated, empty local dimsum_public_corpus_test database");
}
process.env.DATABASE_URL = url;
process.env.SEARCH_OFFLINE_NEIGHBORS_ENABLED = "true";

async function main() {
  // Load an isolated fixture plus the existing identity RPC definition.
  // Install standalone function SQL without changing the Prisma schema.
  // CREATE TABLE fails if the fixture was already installed; never reset a DB.
  for (const file of [
    "scripts/public-corpus/fixture.sql",
    "prisma/migrations/20260625123500_add_editable_level_to_entry_identity_rpc/migration.sql",
    "prisma/functions/search_public_entry_primary.sql",
  ]) {
    execFileSync("psql", [url!, "-v", "ON_ERROR_STOP=1", "-q"], { input: readFileSync(resolve(file)), stdio: ["pipe", "pipe", "pipe"] });
  }
  const { prisma } = await import("../../lib/prisma");
  const { fetchPrimarySearchRows, fetchSemanticSearchRows, fetchAggregatedSearchRows } = await import("../../lib/search/entry-search");
  const { fetchEntryIdentityByUniqueId } = await import("../../lib/search/entry-query");
  const { getCorpusItemForEditing, requireCorpusEditor } = await import("../../lib/services/corpus-edit-access");
  const hiddenId = "00000000-0000-4000-8000-000000000001";
  const publicId = "00000000-0000-4000-8000-000000000002";
  const common = { query: "needle", similarOffset: 0, recommendedOffset: 0, contentAttribute: null, mediaType: null } as const;
  const semantic = { ...common, queryEmbeddingText: "0", primaryCorpusId: BigInt(2), semanticPart: "all" as const };
  const publicOnly = (rows: Array<{ category: string }>) => {
    assert.ok(rows.length > 0, "public results should survive even with 80 higher-ranking private candidates");
    assert.ok(rows.every((row) => row.category === "published"));
  };
  try {
    for (const attribute of [null, "oral"] as const) {
      const rows = await fetchPrimarySearchRows("needle", null, attribute);
      assert.equal(rows[0]?.id, BigInt(2), "private exact match must not win over public prefix match");
      assert.deepEqual(await fetchPrimarySearchRows("needle", ["hidden"], attribute), []);
      publicOnly(await fetchPrimarySearchRows("needle", ["hidden", "published"], attribute));
    }
    for (const part of ["all", "similar", "recommended"] as const) {
      for (const seed of [undefined, null, BigInt(1), BigInt(2)]) {
        const rows = await fetchSemanticSearchRows({ ...semantic, semanticPart: part, primaryCorpusId: seed });
        publicOnly(rows);
        if (part !== "recommended") assert.equal(rows.filter((r) => r.section === "similar").length, 3);
        if (part !== "similar") assert.equal(rows.filter((r) => r.section === "recommended").length, 4);
      }
    }
    publicOnly(await fetchSemanticSearchRows({ ...semantic, similarOffset: 3, recommendedOffset: 4, contentAttribute: "oral", mediaType: "text" }));
    const fallback = await fetchAggregatedSearchRows(common);
    publicOnly(fallback);
    assert.equal(fallback.filter((r) => r.section === "similar").length, 3);
    assert.equal(fallback.filter((r) => r.section === "recommended").length, 4);
    publicOnly(await fetchAggregatedSearchRows({ ...common, similarOffset: 3, recommendedOffset: 4 }));
    assert.equal(await fetchEntryIdentityByUniqueId(hiddenId), null);
    assert.equal((await fetchEntryIdentityByUniqueId(publicId))?.entryId, publicId);
    assert.equal(await fetchEntryIdentityByUniqueId("00000000-0000-4000-8000-000000000003"), null);

    // The deployed RPC need not change: it may return private rows, but the
    // Next.js public query must exclude them within its database statement.
    const rawPrivateRows = await prisma.$queryRaw<Array<{ unique_id: string }>>`select * from get_entry_identities(array[${hiddenId}]::uuid[])`;
    assert.equal(rawPrivateRows.length, 1);
    assert.equal(await fetchEntryIdentityByUniqueId(hiddenId), null);

    // Exercise the real PL/pgSQL RPC, including all five short-circuit tiers.
    await prisma.$executeRawUnsafe(`
      create or replace function fixture_text_match(text, text) returns boolean language sql immutable
      as $$ select $1 ilike '% ' || $2 || ' %' $$
    `);
    await prisma.$executeRaw`insert into cantonese_categories(name,is_public,content_attribute)
      values ('cultural-public',true,'cultural_knowledge'),('empty-public',true,'oral')`;
    await prisma.$executeRaw`insert into cantonese_corpus_all(id,data,category,view_num) values
      (1000,'rankexact','published',0),
      (1001,'UPPERCASEONLY','published',0),
      (1002,'prefixonly suffix','published',0),
      (1003,'word fulltextonly end','published',0),
      (1004,'wordcontainsonlyend','published',0),
      (1005,'rankexact very popular prefix','published',999999),
      (1010,'rankexact','hidden',999999),
      (1020,'cultureexact','cultural-public',0),
      (1051,'deterministic','published',0),
      (1050,'deterministic','published',0)`;
    const quotedTerm = "rpcquote' OR true --";
    await prisma.$executeRaw`insert into cantonese_corpus_all(id,data,category) values (1060,${quotedTerm},'published')`;
    const rpc = (terms: string[] | null, categories: string[] | null = null, attribute: string | null = null) =>
      prisma.$queryRaw<Array<{ id: bigint; rank_order: number }>>`
        select * from search_public_entry_primary(${terms}::text[],${categories}::text[],${attribute}::text)`;
    for (const [term, id, rank] of [
      ['rankexact',1000,0], ['uppercaseonly',1001,1], ['prefixonly',1002,2],
      ['fulltextonly',1003,3], ['containsonly',1004,4], [quotedTerm,1060,0],
    ] as const) {
      const rows = await rpc([term]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, BigInt(id));
      assert.equal(rows[0].rank_order, rank);
    }
    assert.equal((await rpc(['prefixonly','rankexact']))[0].id, BigInt(1000));
    assert.equal((await rpc(['deterministic']))[0].id, BigInt(1050));
    assert.equal((await rpc(['rankexact'],['hidden','published']))[0].id, BigInt(1000));
    for (const categories of [[], ['hidden'], ['missing'], ['empty-public']]) {
      assert.deepEqual(await rpc(['rankexact'], categories), []);
    }
    for (const terms of [null, [], [' ', '']]) assert.deepEqual(await rpc(terms), []);
    assert.deepEqual(await fetchPrimarySearchRows('rankexact', [], null), []);
    assert.deepEqual(await rpc(['cultureexact'], null, 'oral'), []);
    assert.equal((await rpc(['cultureexact'], null, 'cultural_knowledge'))[0].id, BigInt(1020));
    assert.equal((await fetchPrimarySearchRows('cultureexact', null, 'cultural_knowledge'))[0].id, BigInt(1020));
    assert.deepEqual(await fetchPrimarySearchRows('cultureexact', null, 'oral'), []);
    await assert.rejects(rpc(['rankexact'], null, 'invalid'), (error: any) => error.meta?.code === '22023');
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`select * from search_public_entry_primary(array['rankexact'])`;
      assert.equal(rows[0].id, BigInt(1000), 'RPC must work inside read-only transactions');
    });

    for (const userId of [undefined, "learner", "outsider", "reader", "disabled"]) {
      await assert.rejects(getCorpusItemForEditing(userId, hiddenId), (error: any) => error.status === (userId ? 403 : 401));
    }
    for (const userId of ["editor", "researcher", "admin"]) {
      assert.equal((await getCorpusItemForEditing(userId, hiddenId)).category, "hidden");
      // Authorized editors and admins get exactly the same public discovery results.
      assert.deepEqual(await fetchPrimarySearchRows("needle", ["hidden"], null), []);
    }
    await assert.rejects(requireCorpusEditor("outsider", "hidden"), (error: any) => error.status === 403);
    await prisma.user_corpus_permissions.deleteMany({ where: { user_id: "editor" } });
    await assert.rejects(getCorpusItemForEditing("editor", hiddenId), (error: any) => error.status === 403);

    await prisma.cantonese_categories.update({ where: { name: "published" }, data: { is_public: false } });
    assert.deepEqual(await fetchPrimarySearchRows("needle", null, null), []);
    assert.deepEqual(await fetchSemanticSearchRows(semantic), []);
    assert.deepEqual(await fetchAggregatedSearchRows(common), []);
    assert.equal(await fetchEntryIdentityByUniqueId(publicId), null);
    assert.equal((await getCorpusItemForEditing("outsider", publicId)).category, "published");
    console.log("PASS: primary, semantic, fallback, offline neighbors, pagination, staged RPC tiers, input quoting, empty scope, attributes, deterministic ties, details, role matrix, revoked grants, public-to-private transition");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
