-- 新建语料集时在任务上记录语料集类型（对应 cantonese_categories.content_attribute）。
-- 补充已有语料集时为空，沿用已有语料集的类型。入库 Agent 登记新语料集时按它写入。
-- 那边的 packages/corpus-control/sql/ingestion.sql 镜像了本文件，修改时两边同步。

alter table ingestion_tasks
  add column target_content_attribute text
    check (target_content_attribute in ('oral', 'cultural_knowledge'));
