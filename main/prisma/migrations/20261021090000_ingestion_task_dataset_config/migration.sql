-- 入库任务的语料集配置：新建还是补充已有语料集、媒体组成、来源说明。
-- 备注沿用 description 列。入库 Agent 把这些字段写进批次说明。
-- 那边的 packages/corpus-control/sql/ingestion.sql 镜像了本文件，修改时两边同步。

alter table ingestion_tasks
  add column target_ingestion_type text not null default 'new_dataset'
    check (target_ingestion_type in ('new_dataset', 'supplement_existing')),
  add column modalities text[] not null default '{text}'
    check (modalities <@ array['text', 'audio', 'video', 'image'] and 'text' = any(modalities)),
  add column source_collection_method text not null default '';
