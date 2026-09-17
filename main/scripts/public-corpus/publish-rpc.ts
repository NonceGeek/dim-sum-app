import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

loadEnvConfig(process.cwd());
const db = new PrismaClient({ log: [] });
const signature = "public.search_public_entry_primary(text[],text[],text)";
const sql = readFileSync("prisma/functions/search_public_entry_primary.sql", "utf8");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const marker = `dimsum public corpus primary v1; source_sha256=${sha256(sql)}`;

type FunctionRow = { signature: string; definition: string; description: string | null };
async function main() {
  const applying = process.argv.includes("--apply");
  const receipt = await db.$transaction(async (tx) => {
    if (!applying) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'");
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2000ms'");
    const before = await tx.$queryRaw<FunctionRow[]>`
      select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition,
             obj_description(p.oid,'pg_proc') as description
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('search_public_entry_primary','search_entry_primary','get_entry_identities')
      order by p.oid::regprocedure::text`;
    const existing = before.filter((row) => row.signature.startsWith('search_public_entry_primary('));
    const managedReplacement = process.argv.includes("--replace-managed") && existing.length === 1
      && existing[0].description?.startsWith("dimsum public corpus primary v1; source_sha256=");
    if (existing.length && !(existing.length === 1 && existing[0].description === marker) && !managedReplacement) {
      throw new Error("A different public search function already exists; inspect before replacing it");
    }
    let action = "preflight";
    if (applying && (!existing.length || (managedReplacement && existing[0].description !== marker))) {
      await tx.$executeRawUnsafe(sql);
      await tx.$executeRawUnsafe(`comment on function ${signature} is '${marker}'`);
      action = existing.length ? "updated_managed" : "created";
    } else if (applying) action = "already_current";
    const oldSignatures = before.filter((row) => !row.signature.startsWith('search_public_entry_primary('));
    const after = await tx.$queryRaw<FunctionRow[]>`
      select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition,
             obj_description(p.oid,'pg_proc') as description
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('search_public_entry_primary','search_entry_primary','get_entry_identities')
      order by p.oid::regprocedure::text`;
    const oldAfter = after.filter((row) => !row.signature.startsWith('search_public_entry_primary('));
    if (JSON.stringify(oldAfter) !== JSON.stringify(oldSignatures)) throw new Error("Existing functions changed; aborting");
    if (applying) {
      const empty = await tx.$queryRaw<unknown[]>`select * from public.search_public_entry_primary(array['饮茶'],array[]::text[],null)`;
      if (empty.length) throw new Error("Empty scope returned data; aborting");
    }
    return { at: new Date().toISOString(), action, signature, sourceSha256: sha256(sql), oldFunctionsUnchanged: true,
      previousPublicDefinition: existing[0]?.definition ?? null,
      oldFunctions: oldSignatures.map((row) => ({ signature: row.signature, sha256: sha256(row.definition) })),
      functionDefinition: after.find((row) => row.signature.startsWith('search_public_entry_primary('))?.definition ?? null };
  }, { maxWait: 5000, timeout: 30000 });
  mkdirSync("scripts/public-corpus/results", { recursive: true });
  const name = process.argv.includes("--apply") ? "rpc-publication" : "rpc-preflight";
  writeFileSync(`scripts/public-corpus/results/${name}.json`, JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify({ action: receipt.action, signature: receipt.signature, oldFunctionsUnchanged: receipt.oldFunctionsUnchanged }));
}
main().catch((error) => { console.error("RPC publication failed:", error.code ?? error.message); process.exitCode=1; }).finally(()=>db.$disconnect());
