/**
 * 清理 corpus_field_embeddings 的孤儿向量
 * （corpus_id 在 cantonese_corpus_all 中已不存在的向量行）。
 *
 * 背景：schema.prisma 已为 corpus_field_embeddings 增加
 * cantonese_corpus_all(id) ON DELETE CASCADE 外键，之后删除词条会连带删除向量。
 * 历史遗留的孤儿向量会让 db:push 添加外键时违反约束，需要先清掉。
 *
 * 使用方式（在 main 目录，连接来自当前环境配置）：
 *   pnpm tsx scripts/cleanup-orphan-embeddings.ts --dry-run   # 只统计，不删除
 *   pnpm tsx scripts/cleanup-orphan-embeddings.ts             # 分批删除
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const batchSize = 5_000;

type CountRow = { count: bigint };
type IdRow = { id: bigint };

async function countOrphans() {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    select count(*)::bigint as count
    from public.corpus_field_embeddings e
    where not exists (
      select 1 from public.cantonese_corpus_all c where c.id = e.corpus_id
    )
  `;
  return row?.count ?? BigInt(0);
}

async function main() {
  const isDryRun = process.argv.slice(2).includes("--dry-run");
  const total = await countOrphans();
  console.log(`孤儿向量：${total} 条`);
  if (isDryRun || total === BigInt(0)) return;

  let deleted = 0;
  while (true) {
    const rows = await prisma.$queryRaw<IdRow[]>`
      with target as (
        select e.id
        from public.corpus_field_embeddings e
        where not exists (
          select 1 from public.cantonese_corpus_all c where c.id = e.corpus_id
        )
        order by e.id
        limit ${batchSize}
      )
      delete from public.corpus_field_embeddings embeddings
      using target
      where embeddings.id = target.id
      returning embeddings.id
    `;
    if (rows.length === 0) break;
    deleted += rows.length;
    console.log(`已删除 ${deleted}/${total}`);
  }
  console.log(`完成：删除 ${deleted} 条孤儿向量`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
