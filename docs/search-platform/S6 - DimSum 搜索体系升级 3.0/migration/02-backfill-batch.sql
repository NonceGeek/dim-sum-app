-- 每次替换起止 ID 后只执行一个批次，并在批次之间观察数据库状态。
-- 不要把占位值直接提交到数据库。

begin;

update public.cantonese_corpus_all
set media_types = public.derive_corpus_media_types(data, note, structured_note)
where id between :start_id and :end_id
  and media_types is distinct from
    public.derive_corpus_media_types(data, note, structured_note);

commit;

-- 批次核对
select
  min(id) as start_id,
  max(id) as end_id,
  count(*) as row_count,
  count(*) filter (
    where media_types is distinct from
      public.derive_corpus_media_types(data, note, structured_note)
  ) as mismatch_count
from public.cantonese_corpus_all
where id between :start_id and :end_id;
