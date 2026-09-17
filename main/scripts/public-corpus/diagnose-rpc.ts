import { loadEnvConfig } from '@next/env';
import { Prisma } from '@prisma/client';
import { writeFileSync } from 'node:fs';
loadEnvConfig(process.cwd());
async function main() {
 const {prisma: db}=await import('../../lib/prisma');
 const {buildPrimarySearchSql}=await import('../../lib/search/entry-search');
 const plans:any[]=[];
 const run=(sql:Prisma.Sql)=>db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  await tx.$queryRaw`select set_config('statement_timeout','5000ms',true)`;
  return tx.$queryRaw<any[]>(sql);
 },{timeout:12000,maxWait:5000});
 try {
  const meta=await run(Prisma.sql`select p.prorows,p.procost,p.proconfig from pg_proc p where p.oid='public.search_public_entry_primary(text[],text[],text)'::regprocedure`);
  console.log('metadata',meta);
  plans.push({label:'api_plan',plan:await run(Prisma.sql`explain (format json) ${buildPrimarySearchSql('饮茶',null,null)}`)});
  const scopes=await run(Prisma.sql`select name from cantonese_categories where is_public=true`);
  const names=scopes.map(s=>s.name);
  const predicates=[Prisma.sql`c.data='饮茶' or c.data='飲茶'`,Prisma.sql`lower(c.data)=lower('饮茶') or lower(c.data)=lower('飲茶')`,Prisma.sql`c.data ilike '饮茶%' or c.data ilike '飲茶%'`];
  for (let i=0;i<predicates.length;i++) {
   const start=performance.now();
   try {
    const rows=await run(Prisma.sql`explain (analyze,buffers,format json,timing off)
     select c.id,c.unique_id,${i}::integer from cantonese_corpus_all c
     where c.category=any(${names}::text[]) and (${predicates[i]})
     order by length(c.data),c.view_num desc,c.bookmark_num desc,c.liked_num desc,c.id asc limit 1`);
    console.log('tier',i,rows[0]['QUERY PLAN'][0]['Execution Time']); plans.push({label:`tier_${i}`,rows});
   } catch(e:any) {console.log('tier',i,'failed',e.meta?.code??e.code,'wall',performance.now()-start);}
  }
  for(const terms of [['的'],['饮茶','飲茶']]) {
   try {
    const rows=await run(Prisma.sql`explain (analyze,buffers,format json,timing off) select * from search_public_entry_primary(${terms}::text[])`);
    console.log('rpc',terms,rows[0]['QUERY PLAN'][0]['Execution Time']);plans.push({label:`rpc_${terms[0]}`,rows});
   }catch(e:any){console.log('rpc',terms,'failed',e.meta?.code??e.code);}
  }
 }finally{writeFileSync('scripts/public-corpus/results/rpc-diagnostics.json',JSON.stringify(plans,null,2));await db.$disconnect();}
}
main().catch(e=>{console.error(e.code??e.name);process.exitCode=1;});
