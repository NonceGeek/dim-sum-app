-- ONLY AFTER the new application is deployed and old writers/rollbacks are retired.
-- The new application must no longer read/write the entry-level attribute.
-- No CASCADE: unexpected database dependencies must stop the operation.
begin;
select pg_advisory_xact_lock(917320260913);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cantonese_categories' and column_name='content_attribute') then
    raise exception 'Expand/backfill has not been applied';
  end if;
  if exists (select 1 from public.corpus_collection_activities where dataset_name is null) then
    raise exception 'Activities without a dataset remain; rerun backfill after retiring old writers';
  end if;
end $$;
alter table public.corpus_collection_activities alter column dataset_name set not null;
alter table public.cantonese_corpus_all drop column if exists content_attribute;
commit;
