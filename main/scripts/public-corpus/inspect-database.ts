import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";

loadEnvConfig(process.cwd());
const db = new PrismaClient({ log: [] });
async function main() {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'");
    const version = await tx.$queryRaw`select current_setting('server_version') as version`;
    const functions = await tx.$queryRaw`select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('search_entry_primary','get_entry_identities') order by p.oid::regprocedure::text`;
    const indexes = await tx.$queryRaw`select tablename, indexname, indexdef from pg_indexes where schemaname='public' and tablename in ('cantonese_corpus_all','cantonese_categories') order by tablename,indexname`;
    const extensions = await tx.$queryRaw`select extname,extversion from pg_extension where extname in ('pgroonga','vector','pg_stat_statements')`;
    const sizes = await tx.$queryRaw`select relname,reltuples::bigint as estimated_rows, pg_total_relation_size(oid) as bytes from pg_class where oid in ('public.cantonese_corpus_all'::regclass,'public.cantonese_categories'::regclass)`;
    const visibility = await tx.$queryRaw`select is_public,count(*)::int as dataset_count from public.cantonese_categories group by is_public`;
    return { version, functions, indexes, extensions, sizes, visibility };
  }, { maxWait: 5000, timeout: 25000 });
  mkdirSync("scripts/public-corpus/results", { recursive: true });
  writeFileSync("scripts/public-corpus/results/database-inspection.json", JSON.stringify(result, (_key,value)=>typeof value==='bigint'?value.toString():value,2)+"\n");
  console.log(JSON.stringify(result, (_key,value)=>typeof value==='bigint'?value.toString():value,2));
}
main().catch((error) => { console.error("Read-only database inspection failed:", error.code ?? error.name); process.exitCode=1; }).finally(()=>db.$disconnect());
