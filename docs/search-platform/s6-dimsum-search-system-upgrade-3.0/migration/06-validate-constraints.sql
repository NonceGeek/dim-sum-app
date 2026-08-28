-- 仅在 03-verify.sql 的合法性和派生一致性检查全部为 0 后执行。

alter table public.cantonese_corpus_all
  validate constraint corpus_content_attribute_ck;

alter table public.cantonese_corpus_all
  validate constraint corpus_media_types_ck;
