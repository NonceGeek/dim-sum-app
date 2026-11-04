import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleEntrySearch } from "./entry-search-handler";

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
