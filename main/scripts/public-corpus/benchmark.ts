import { loadEnvConfig } from "@next/env";
import { Prisma } from "@prisma/client";
import * as OpenCC from "opencc-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildDirectBaseline } from "./query-baseline";

loadEnvConfig(process.cwd());
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });
const smoke = process.argv.includes("--smoke");
const outputDir = "scripts/public-corpus/results";
const timeoutMs = 5000;

type Scenario = { label: string; keyword: string; datasets: string[] | null };
type Variant = "direct_sql" | "existing_rpc_public_scope" | "staged_public_sql";

async function main() {
  const { prisma: db } = await import("../../lib/prisma");
  const { buildPrimarySearchSql } = await import("../../lib/search/entry-search");
  const readOnly = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
    return fn(tx);
  }, { maxWait: 5000, timeout: 12000 });

  const scenarios: Scenario[] = [
    { label: "common", keyword: "饮茶", datasets: null },
    { label: "common_traditional", keyword: "粵語", datasets: null },
    { label: "exact", keyword: "早晨", datasets: null },
    { label: "single_character", keyword: "的", datasets: null },
    { label: "rare", keyword: "龘", datasets: null },
    { label: "no_match", keyword: "dimsumvisibilitynomatch9f721b", datasets: null },
    { label: "requested_missing_dataset", keyword: "饮茶", datasets: ["__nonexistent_benchmark_dataset__"] },
  ];
  const variants: Variant[] = process.argv.includes("--candidate-only") ? ["staged_public_sql"] : ["direct_sql", "existing_rpc_public_scope", "staged_public_sql"];
  function queryFor(scenario: Scenario, variant: Variant) {
    const rpcQuery = buildPrimarySearchSql(scenario.keyword, scenario.datasets, null);
    const direct = buildDirectBaseline(rpcQuery, scenario.keyword, scenario.datasets);
    if (variant === "direct_sql") return direct;
    // Reuse the exact production result projection / identity aggregation. Only
    // primary candidate selection differs. Neither extracted fragment has binds.
    const prefixEnd = direct.sql.indexOf(", primary_match as (");
    const suffixStart = direct.sql.indexOf("\n      select\n        'primary'");
    if (prefixEnd < 0 || suffixStart < 0) throw new Error("Primary SQL structure changed");
    const prefix = direct.sql.slice(0, prefixEnd);
    const suffix = direct.sql.slice(suffixStart);
    if (prefix.includes("?") || suffix.includes("?")) throw new Error("Unexpected bound outer projection");
    const terms = [...new Set([scenario.keyword, toSimplified(scenario.keyword), toTraditional(scenario.keyword)])];
    if (variant === "staged_public_sql") {
      const datasetRestriction = scenario.datasets?.length
        ? Prisma.sql`and c.category in (${Prisma.join(scenario.datasets)})` : Prisma.empty;
      const conditions = [
        Prisma.sql`c.data in (${Prisma.join(terms)})`,
        Prisma.sql`lower(c.data) in (${Prisma.join(terms.map((term) => term.toLowerCase()))})`,
        Prisma.sql`(${Prisma.join(terms.map((term) => Prisma.sql`c.data ilike ${`${term}%`}`), " or ")})`,
        Prisma.sql`(${Prisma.join(terms.map((term) => Prisma.sql`c.data &@~ ${term}`), " or ")})`,
        Prisma.sql`(${Prisma.join(terms.map((term) => Prisma.sql`c.data ilike ${`%${term}%`}`), " or ")})`,
      ];
      const tiers = conditions.map((condition, index) => {
        const guards = Array.from({ length: index }, (_, earlier) => Prisma.raw(`and not exists (select 1 from tier_${earlier})`));
        return Prisma.sql`${Prisma.raw(`tier_${index}`)} as materialized (
          select c.unique_id from public_corpus c
          where ${condition} ${datasetRestriction} ${guards.length ? Prisma.join(guards, " ") : Prisma.empty}
          order by length(c.data), c.view_num desc, c.bookmark_num desc, c.liked_num desc
          limit 1
        )`;
      });
      return Prisma.sql`${Prisma.raw(prefix)}, ${Prisma.join(tiers)}, primary_match as (
        ${Prisma.join(conditions.map((_, i) => Prisma.raw(`select unique_id from tier_${i}`)), " union all ")}
      ) ${Prisma.raw(suffix)}`;
    }
    const datasetRestriction = scenario.datasets?.length
      ? Prisma.sql`and ds.name in (${Prisma.join(scenario.datasets)})` : Prisma.empty;
    return Prisma.sql`${Prisma.raw(prefix)}, allowed_scope as materialized (
      select array_agg(ds.name)::text[] as names
      from public.cantonese_categories ds
      where ds.is_public = true ${datasetRestriction}
    ), primary_match as (
      select pm.unique_id
      from allowed_scope a
      cross join lateral public.search_entry_primary(array[${Prisma.join(terms)}]::text[], a.names) pm
      where cardinality(a.names) > 0
    ) ${Prisma.raw(suffix)}`;
  }
  const samples: any[] = [];
  const checks: any[] = [];
  mkdirSync(outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  function persist() {
    writeFileSync(`${outputDir}/${smoke ? (process.argv.includes("--candidate-only") ? "candidate-smoke" : "smoke") : "benchmark"}.json`, JSON.stringify({ startedAt, timeoutMs, runs: smoke ? 1 : 3, mode: "read-only sequential; round 0 first observed/warmup; timing off; complete primary query including identity aggregation", scenarios, samples, checks }, null, 2)+"\n");
  }
  try {
    const selected = await readOnly((tx) => tx.$queryRaw<Array<{ name: string }>>`
      select name from cantonese_categories where is_public = true order by (name = 'zyzdv2') desc, name limit 1`);
    if (selected.length) scenarios.push({ label: "specific_public_dataset", keyword: "早晨", datasets: [selected[0].name] });
    const activeScenarios = smoke ? scenarios.slice(0, 1) : scenarios;
    for (let round = 0; round < (smoke ? 1 : 4); round++) {
      for (const scenario of activeScenarios) {
        for (const variant of round % 2 ? [...variants].reverse() : variants) {
          if (samples.filter((sample) => sample.scenario === scenario.label && sample.variant === variant && sample.error).length >= 2) continue;
          const sql = queryFor(scenario, variant);
          const start = performance.now();
          try {
            const rows = await readOnly((tx) => tx.$queryRaw<any[]>(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF) ${sql}`));
            const plan = rows[0]["QUERY PLAN"][0];
            samples.push({ scenario: scenario.label, variant, round, wallMs: performance.now()-start, executionMs: plan["Execution Time"], planningMs: plan["Planning Time"], rows: plan.Plan["Actual Rows"], sharedHits: plan.Plan["Shared Hit Blocks"], sharedReads: plan.Plan["Shared Read Blocks"], plan });
            console.log(JSON.stringify({ scenario: scenario.label, variant, round, executionMs: plan["Execution Time"], planningMs: plan["Planning Time"], rows: plan.Plan["Actual Rows"] }));
          } catch (error: any) {
            const sqlState = error.meta?.code ?? error.code;
            samples.push({ scenario: scenario.label, variant, round, wallMs: performance.now()-start, error: sqlState });
            console.log(JSON.stringify({ scenario: scenario.label, variant, round, error: sqlState }));
            if (samples.filter((sample) => sample.error).length >= 12) { persist(); throw new Error("Stopped after 12 failures to limit database load"); }
          }
          persist();
        }
      }
    }
    if (!smoke) for (const scenario of activeScenarios) {
      const results: Record<string, unknown> = {};
      for (const variant of variants) {
        if (samples.some((sample) => sample.scenario === scenario.label && sample.variant === variant && sample.error)) {
          results[variant] = { skipped: "timed out during measurement" };
          continue;
        }
        const query = queryFor(scenario, variant);
        const rows = await readOnly((tx) => tx.$queryRaw<Array<{ unique_id: string; category: string }>>(Prisma.sql`select unique_id, category from (${query}) measured`));
        // Do not retain corpus content or identifiers in benchmark artifacts.
        results[variant] = { rows: rows.length, resultHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
      }
      checks.push({ scenario: scenario.label, results, equal: new Set(Object.values(results).map((value) => JSON.stringify(value))).size === 1 });
      persist();
    }
    console.log("Saved read-only benchmark results.");
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error("Benchmark stopped:", error.code ?? error.name); process.exitCode=1; });
