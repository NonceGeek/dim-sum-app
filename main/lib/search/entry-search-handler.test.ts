import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleEntrySearch } from "./entry-search-handler";
import { fetchAggregatedSearchRows, fetchSemanticSearchRows } from "./entry-search";

const originalTransaction = prisma.$transaction;
const originalFetch = globalThis.fetch;
const originalError = console.error;
const envNames = ["SEARCH_EMBEDDING_RELAY_SECRET", "SEARCH_EMBEDDING_RELAY_URL", "VERCEL_URL"];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const primary = {
  section: "primary", item_order: 0, id: BigInt(162),
  unique_id: "9fb359b2-f561-4264-8e5e-ec899fb0cab1", data: "饮茶",
  category: "public", note: {}, structured_note: null,
  content_attribute: "oral", media_types: ["text"],
  created_at: new Date(), updated_at: new Date(),
  liked_num: BigInt(0), bookmark_num: BigInt(0), view_num: BigInt(0),
  primary_category_id: null, secondary_category_id: null,
};
const embedding = () => Response.json({ embedding: `[${Array(1024).fill(0.25)}]` });
const request = (q: string) => handleEntrySearch(
  new NextRequest(`https://example.com/api/search/entries?q=${q}`),
  { recordWebSearch: false },
);
function mockTransactions(run: (sql: Prisma.Sql, index: number) => unknown) {
  const queries: Prisma.Sql[] = [];
  prisma.$transaction = (async (callback: any) => callback({
    $executeRawUnsafe: async () => 0,
    $queryRaw: async (sql: Prisma.Sql) => {
      queries.push(sql);
      return run(sql, queries.length - 1);
    },
  })) as typeof prisma.$transaction;
  return queries;
}
test.beforeEach(() => {
  process.env.SEARCH_EMBEDDING_RELAY_SECRET = "test-secret";
  process.env.SEARCH_EMBEDDING_RELAY_URL = "https://relay.example/api/search/embedding-relay";
  globalThis.fetch = async () => embedding();
  console.error = () => {};
});
test.afterEach(() => {
  prisma.$transaction = originalTransaction;
  globalThis.fetch = originalFetch;
  console.error = originalError;
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("all overlaps embedding with primary and passes the resolved seed to semantic SQL", async () => {
  let finishEmbedding!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { finishEmbedding = resolve; });
  const queries = mockTransactions((_sql, i) => i === 0 ? [primary] : []);
  const responsePromise = request("seed-overlap-test");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queries.length, 1, "semantic SQL waits while embedding is pending");
  finishEmbedding(embedding());
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.primary.corpusId, 162);
  assert.equal(result.sectionStatus.semantic, "success");
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /where c\.id = \?/);
  assert.ok(queries[1].values.includes(BigInt(162)));
});

test("no primary match supplies none instead of repeating text matching", async () => {
  const queries = mockTransactions(() => []);
  const response = await request("no-primary-seed-test");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).primary, null);
  assert.match(queries[1].sql, /where false/);
});

test("embedding failure fallback also reuses the primary seed", async () => {
  globalThis.fetch = async () => Response.json({ message: "unavailable" }, { status: 502 });
  const queries = mockTransactions((_sql, i) => i === 0 ? [primary] : []);
  const result = await (await request("fallback-seed-test")).json();
  assert.equal(result.primary.corpusId, 162);
  assert.equal(result.sectionStatus.semantic, "fallback");
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /where c\.id = \?/);
  assert.ok(queries[1].values.includes(BigInt(162)));
});

test("primary timeout returns retryable 503 and never starts semantic DB work", async () => {
  const queries = mockTransactions(() => { throw new Prisma.PrismaClientKnownRequestError(
    "statement timeout", { code: "P2010", clientVersion: "6.19.0", meta: { code: "57014" } },
  ); });
  const response = await request("primary-timeout-test");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "1");
  assert.equal((await response.json()).code, "DATABASE_BUSY");
  assert.equal(queries.length, 1);
});

test("expired semantic transaction preserves primary without another expensive fallback", async () => {
  const queries = mockTransactions((_sql, i) => {
    if (i === 0) return [primary];
    throw new Prisma.PrismaClientKnownRequestError("expired", { code: "P2028", clientVersion: "6.19.0" });
  });
  const response = await request("semantic-expired-test");
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.primary.corpusId, 162);
  assert.equal(result.sectionStatus.semantic, "error");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(queries.length, 2);
});

async function relatedSql(path: "semantic" | "fallback", semanticPart: "all" | "similar" | "recommended", mediaType: "model3d" | "text" | null) {
  const queries = mockTransactions(() => []);
  const common = { query: "帆船", primaryCorpusId: BigInt(162), similarOffset: 0, recommendedOffset: 0, contentAttribute: null, mediaType };
  if (path === "semantic") await fetchSemanticSearchRows({ ...common, queryEmbeddingText: "[0.25]", semanticPart });
  else await fetchAggregatedSearchRows(common);
  return queries[0].sql;
}
// The text between a CTE's opening and the next top-level CTE.
const cte = (sql: string, name: string) => {
  const start = sql.search(new RegExp(`[\\s,]${name} as \\(`));
  assert.ok(start >= 0, `${name} CTE exists`);
  const rest = sql.slice(start + 1);
  const next = rest.slice(1).search(/\n      [a-z_]+ as (not materialized )?\(/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const model3dFilter = /candidate\.media_types @> array\[\$?\??\d*\]::text\[\]/;

test("similar media filters apply before the semantic vector LIMIT, leaving recommended unfiltered", async () => {
  for (const part of ["all", "similar", "recommended"] as const) {
    const sql = await relatedSql("semantic", part, "model3d");
    const similarVectors = cte(sql, "similar_semantic_candidates");
    assert.match(similarVectors, model3dFilter);
    assert.ok(similarVectors.search(model3dFilter) < similarVectors.indexOf("limit 48"));
    assert.match(cte(sql, "similar_candidates"), /from similar_semantic_candidates/);
    assert.doesNotMatch(cte(sql, "semantic_candidates"), /media_types/);
    assert.match(cte(sql, "recommended_candidates"), /from semantic_candidates\b/);
    assert.match(cte(sql, "similar_ranked"), /s\.media_types @>/, "tag/category similar candidates are filtered too");
  }
  const text = await relatedSql("semantic", "similar", "text");
  assert.match(cte(text, "similar_semantic_candidates"), /candidate\.media_types = array\['text'\]::text\[\][\s\S]*limit 48/);
  const unfiltered = await relatedSql("semantic", "all", null);
  assert.doesNotMatch(unfiltered, /similar_semantic_candidates|media_types (@>|=)/);
});

test("fallback similar media filters apply before the vector LIMIT 12, leaving recommended unfiltered", async () => {
  for (const mediaType of ["model3d", "text"] as const) {
    const sql = await relatedSql("fallback", "all", mediaType);
    const similar = cte(sql, "similar_candidates");
    const filter = mediaType === "text" ? /candidate\.media_types = array\['text'\]/ : model3dFilter;
    assert.match(similar, filter);
    assert.ok(similar.search(filter) < similar.indexOf("limit 12"));
    assert.doesNotMatch(cte(sql, "recommended_candidates"), /media_types/);
  }
});

test("recommended excludes the media-filtered similar page on both paths", async () => {
  for (const path of ["semantic", "fallback"] as const) {
    const sql = await relatedSql(path, "all", "model3d");
    assert.doesNotMatch(sql, /similar_exclusion_ids/);
    assert.match(cte(sql, "recommended_ranked"), /not exists \(\s*select 1 from similar_ids s where s\.id = c\.id/);
  }
});
