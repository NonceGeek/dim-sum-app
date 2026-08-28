-- 生成时间：2026-08-28
-- 生成方式：Production datasource -> 本地目标 schema 的 prisma migrate diff（只读）
-- 审查结论：只有两列和两个索引，无 DROP、表重建或旧字段变更。
-- 注意：media_types 的 NOT NULL 由 01-supplemental-schema.sql 补齐。

-- AlterTable
alter table "cantonese_corpus_all"
  add column "content_attribute" text not null default 'unclassified',
  add column "media_types" text[] default array['text']::text[];

-- CreateIndex
create index "cantonese_corpus_all_content_attribute_idx"
  on "cantonese_corpus_all"("content_attribute");

-- CreateIndex
create index "cantonese_corpus_all_media_types_gin_idx"
  on "cantonese_corpus_all" using gin ("media_types");
