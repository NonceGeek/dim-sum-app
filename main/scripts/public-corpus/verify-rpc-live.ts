import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { Prisma } from "@prisma/client";
import * as OpenCC from "opencc-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildDirectBaseline } from "./query-baseline";

loadEnvConfig(process.cwd());
type Attribute = "oral" | "cultural_knowledge" | null;
type Scenario = { label: string; keyword: string; datasets: string[] | null; attribute: Attribute; expectEmpty?: boolean; expectHit?: boolean };
const simplified = OpenCC.Converter({ from: "hk", to: "cn" });
const traditional = OpenCC.Converter({ from: "cn", to: "hk" });
const smoke = process.argv.includes("--smoke");

async function main() {
  const { prisma: db } = await import("../../lib/prisma");
  const { buildPrimarySearchSql } = await import("../../lib/search/entry-search");
  const readOnly = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$queryRaw`select set_config('statement_timeout','5000ms',true), set_config('lock_timeout','500ms',true)`;
    return fn(tx);
  }, { maxWait: 5000, timeout: 18000, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const scenarios: Scenario[] = [
    { label: "common", keyword: "饮茶", datasets: null, attribute: null },
    { label: "common_traditional", keyword: "粵語", datasets: null, attribute: null },
    { label: "greeting", keyword: "早晨", datasets: null, attribute: null },
    { label: "single_character", keyword: "的", datasets: null, attribute: null },
    { label: "rare", keyword: "龘", datasets: null, attribute: null },
    { label: "no_match", keyword: "dimsumvisibilitynomatch9f721b", datasets: null, attribute: null, expectEmpty: true },
    { label: "empty_scope", keyword: "的", datasets: [], attribute: null, expectEmpty: true },
    { label: "missing_dataset", keyword: "的", datasets: ["__nonexistent_benchmark_dataset__"], attribute: null, expectEmpty: true },
  ];
  const samples: any[] = [];
  const checks: any[] = [];
  const startedAt = new Date().toISOString();
  mkdirSync("scripts/public-corpus/results", { recursive: true });
  const output = `scripts/public-corpus/results/${smoke ? "rpc-smoke" : "rpc-live-verification"}.json`;
  const save = () => writeFileSync(output, JSON.stringify({ startedAt, mode: "read-only sequential actual RPC; round 0 warmup then 3 samples; full primary projection", scenarios: scenarios.map(({ label, keyword, attribute }) => ({ label, keyword, attribute })), samples, checks }, null, 2)+"\n");
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  function sqlFor(s: Scenario) { return buildPrimarySearchSql(s.keyword, s.datasets, s.attribute); }
  async function sortKey(tx: Prisma.TransactionClient, id: string, query: string) {
    const terms = [...new Set([query, simplified(query), traditional(query)])];
    return tx.$queryRaw<any[]>(Prisma.sql`select case
      when c.data in (${Prisma.join(terms)}) then 0
      when lower(c.data) in (${Prisma.join(terms.map((t) => t.toLowerCase()))}) then 1
      when (${Prisma.join(terms.map((t) => Prisma.sql`c.data ilike ${t+'%'}`), ' or ')}) then 2
      when (${Prisma.join(terms.map((t) => Prisma.sql`c.data &@~ ${t}`), ' or ')}) then 3
      else 4 end as rank, length(c.data) as length,
      c.view_num::text,c.bookmark_num::text,c.liked_num::text
      from cantonese_corpus_all c where c.id = ${BigInt(id)}`);
  }
  try {
    console.log("Preparing read-only validation scenarios");
    const setup = smoke ? { privateDataset: [], positive: [], attributes: [] } : await readOnly(async (tx) => {
      const privateDataset = await tx.$queryRaw<Array<{ name: string }>>`select name from cantonese_categories where is_public=false order by name limit 1`;
      const positive = await tx.$queryRaw<Array<{ data: string; category: string }>>`
        select c.data,c.category from cantonese_corpus_all c
        join cantonese_categories ds on ds.name=c.category and ds.is_public=true
        where c.data in ('粵語','的','早晨') order by c.id limit 1`;
      const attributes = await tx.$queryRaw<Array<{ content_attribute: "oral" | "cultural_knowledge"; data: string; category: string }>>`
        select ds.content_attribute,c.data,c.category
        from (values ('oral'),('cultural_knowledge')) a(attribute)
        cross join lateral (
          select c.data,c.category from cantonese_corpus_all c
          join cantonese_categories d on d.name=c.category
          where d.is_public=true and d.content_attribute=a.attribute
            and c.data in ('粵語','的','早晨','船','係','你')
          limit 1
        ) c join cantonese_categories ds on ds.name=c.category`;
      return { privateDataset, positive, attributes };
    });
    if (setup.privateDataset[0]) scenarios.push({ label: "private_scope", keyword: "的", datasets: [setup.privateDataset[0].name], attribute: null, expectEmpty: true });
    if (setup.positive[0]) scenarios.push({ label: "public_scope_positive", keyword: setup.positive[0].data, datasets: [setup.positive[0].category], attribute: null, expectHit: true });
    for (const row of setup.attributes) scenarios.push({ label: `attribute_${row.content_attribute}`, keyword: row.data, datasets: [row.category], attribute: row.content_attribute, expectHit: true });
    const active = smoke ? scenarios.slice(0, 2) : scenarios;
    for (const s of active) {
      console.log(`Checking ${s.label}`);
      const result = await readOnly(async (tx) => {
        const rpcSql = sqlFor(s);
        const baseline = buildDirectBaseline(rpcSql, s.keyword, s.datasets, s.attribute);
        const select = (sql: Prisma.Sql) => tx.$queryRaw<Array<{ id: string; unique_id: string; category: string }>>(Prisma.sql`select id::text,unique_id,category from (${sql}) result`);
        const actual = await select(rpcSql);
        console.log(`RPC returned for ${s.label}; comparing baseline`);
        const reference = await select(baseline);
        if (s.expectEmpty) assert.equal(actual.length, 0);
        if (s.expectHit) assert.equal(actual.length, 1);
        assert.equal(actual.length, reference.length);
        const exactResult = hash(actual) === hash(reference);
        if (!exactResult) {
          assert.deepEqual(await sortKey(tx, actual[0].id, s.keyword), await sortKey(tx, reference[0].id, s.keyword));
          assert.ok(BigInt(actual[0].id) <= BigInt(reference[0].id), 'new tie-break must select smallest id');
        }
        if (actual.length) {
          const scope = await tx.$queryRaw<Array<{ is_public: boolean; content_attribute: string }>>`select is_public,content_attribute from cantonese_categories where name=${actual[0].category}`;
          assert.equal(scope[0]?.is_public,true);
          if (s.attribute) assert.equal(scope[0].content_attribute,s.attribute);
          if (s.datasets) assert.ok(s.datasets.includes(actual[0].category));
        }
        return { scenario: s.label, rows: actual.length, exactResult, rankingEquivalent: true, resultHash: hash(actual) };
      });
      checks.push(result); save(); console.log(JSON.stringify({ check: s.label, rows: result.rows, exactResult: result.exactResult }));
    }
    for (let round=0; round<(smoke ? 1 : 4); round++) for (const s of active) {
      const start = performance.now();
      const rows = await readOnly((tx) => tx.$queryRaw<any[]>(Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON,TIMING OFF) ${sqlFor(s)}`));
      const plan = rows[0]['QUERY PLAN'][0];
      samples.push({ scenario: s.label, round, executionMs: plan['Execution Time'], planningMs: plan['Planning Time'], wallMs: performance.now()-start, rows: plan.Plan['Actual Rows'], plan: round===0 ? plan : undefined });
      save(); console.log(JSON.stringify({ scenario: s.label, round, executionMs: plan['Execution Time'] }));
    }
    console.log('PASS: actual public RPC correctness and performance');
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error('Live RPC verification failed:',error.code ?? error.message); process.exitCode=1; });
