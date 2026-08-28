-- 导出范围：仍未可靠判断为 oral/cultural_knowledge 的存量语料。
-- 结果按来源和 ID 稳定排序，交由后续人工或 Agent 流程处理；本脚本不修改数据。

select
  c.id as corpus_id,
  c.unique_id as entry_id,
  c.data as entry_name,
  c.category as source_category,
  source.nickname as source_corpus_name,
  parent.name as current_primary_category,
  child.name as current_secondary_category,
  c.lifecycle_stage,
  c.media_types,
  left(c.data, 500) as original_text_preview,
  c.created_at,
  c.updated_at,
  'mixed_source'::text as unclassified_reason
from public.cantonese_corpus_all c
left join public.cantonese_categories source
  on source.name = c.category
left join public.corpus_category assignment
  on assignment.corpus_id = c.id
left join public.content_categories child
  on child.id = assignment.category_id
left join public.content_categories parent
  on parent.id = child.parent_id
where c.content_attribute = 'unclassified'
order by c.category, c.id;
