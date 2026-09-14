-- Run after live schema pull/diff review. Compatible with the old application.
begin;
select pg_advisory_xact_lock(917320260913);
alter table public.cantonese_categories
  add column if not exists content_attribute text not null default 'unclassified';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.cantonese_categories'::regclass and conname = 'dataset_content_attribute_ck') then
    alter table public.cantonese_categories add constraint dataset_content_attribute_ck
      check (content_attribute in ('unclassified', 'oral', 'cultural_knowledge'));
  end if;
end $$;
create index if not exists cantonese_categories_content_attribute_idx on public.cantonese_categories(content_attribute);
alter table public.corpus_collection_activities
  add column if not exists dataset_name text,
  add column if not exists creation_key uuid,
  add column if not exists creation_hash text;
create unique index if not exists corpus_collection_activities_dataset_name_key on public.corpus_collection_activities(dataset_name);
create unique index if not exists corpus_collection_activities_creation_key_key on public.corpus_collection_activities(creation_key);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.corpus_collection_activities'::regclass and conname = 'corpus_collection_activities_dataset_name_fkey') then
    alter table public.corpus_collection_activities add constraint corpus_collection_activities_dataset_name_fkey
      foreign key (dataset_name) references public.cantonese_categories(name) on delete restrict on update restrict;
  end if;
end $$;

-- Only a unanimous, classified source can be migrated automatically.
-- Do not overwrite already configured datasets on a repeat execution.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cantonese_corpus_all' and column_name = 'content_attribute') then
    execute $sql$
      update public.cantonese_categories d set content_attribute = s.attribute
      from (
        select category, min(content_attribute) as attribute
        from public.cantonese_corpus_all group by category
        having count(distinct content_attribute) = 1
          and min(content_attribute) in ('oral', 'cultural_knowledge')
      ) s where d.name = s.category and d.content_attribute = 'unclassified'
    $sql$;
  end if;
end $$;

-- Existing activities get their own empty dataset; never infer an attribute from a title.
do $$ begin
  if exists (
    select 1 from public.corpus_collection_activities a
    join public.cantonese_categories d on d.name = 'activity-' || a.display_uuid::text
    where a.dataset_name is null
  ) then raise exception 'Existing dataset key collision; review before backfill'; end if;
end $$;
insert into public.cantonese_categories (name, nickname, description, content_attribute, is_public, if_in_all_data)
select 'activity-' || display_uuid::text, title, description, 'unclassified', false, false
from public.corpus_collection_activities where dataset_name is null;
update public.corpus_collection_activities
set dataset_name = 'activity-' || display_uuid::text where dataset_name is null;
commit;
