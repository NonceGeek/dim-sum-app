-- 1. 字段、默认值、索引、约束和 trigger
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cantonese_corpus_all'
  and column_name in ('content_attribute', 'media_types')
order by column_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'cantonese_corpus_all'
  and indexname in (
    'cantonese_corpus_all_content_attribute_idx',
    'cantonese_corpus_all_media_types_gin_idx'
  )
order by indexname;

select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.cantonese_corpus_all'::regclass
  and conname in ('corpus_content_attribute_ck', 'corpus_media_types_ck')
order by conname;

select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.cantonese_corpus_all'::regclass
  and not tgisinternal
  and tgname = 'corpus_media_types_derive_trg';

-- 2. 数据合法性与派生一致性；四个 bad/mismatch 数量必须都是 0。
select
  count(*) filter (
    where content_attribute not in ('unclassified', 'oral', 'cultural_knowledge')
  ) as bad_content_attribute_count,
  count(*) filter (
    where cardinality(media_types) = 0 or media_types is null
  ) as empty_media_types_count,
  count(*) filter (
    where not media_types <@ array['text', 'audio', 'video', 'image', 'model3d']::text[]
       or media_types[1] is distinct from 'text'
  ) as bad_media_types_count,
  count(*) filter (
    where media_types is distinct from
      public.derive_corpus_media_types(data, note, structured_note)
  ) as media_derivation_mismatch_count
from public.cantonese_corpus_all;

-- 3. Production 审计基线。完成全量回填后的预期组合：
-- text=9,983；text+audio=40,995；text+image=10；text+video=5；text+audio+model3d=1。
select media_types, count(*) as row_count
from public.cantonese_corpus_all
group by media_types
order by row_count desc, media_types;

-- 4. 固定 3D 样本必须为 {text,audio,model3d}。
select id, unique_id, data, media_types, note -> 'context' as legacy_context
from public.cantonese_corpus_all
where unique_id = '9fb359b2-f561-4264-8e5e-ec899fb0cab1'::uuid;

-- 5. 确认约束前再次运行全部检查，通过后再单独执行：
-- alter table public.cantonese_corpus_all validate constraint corpus_content_attribute_ck;
-- alter table public.cantonese_corpus_all validate constraint corpus_media_types_ck;
