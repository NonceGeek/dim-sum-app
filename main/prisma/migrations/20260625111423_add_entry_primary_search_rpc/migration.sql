create or replace function public.search_entry_primary(p_query_variants text[])
returns table (
  id bigint,
  unique_id uuid,
  rank_order integer
)
language sql
stable
as $$
  with terms as (
    select distinct btrim(term) as term
    from unnest(p_query_variants) as term
    where btrim(term) <> ''
  ),
  ranked as (
    select
      c.id,
      c.unique_id,
      min(
        case
          when c.data = t.term then 0
          when lower(c.data) = lower(t.term) then 1
          when c.data ilike t.term || '%' then 2
          when c.data &@~ t.term then 3
          when c.data ilike '%' || t.term || '%' then 4
          else 5
        end
      ) as rank_order,
      min(length(c.data)) as data_length,
      max(c.view_num) as view_num,
      max(c.bookmark_num) as bookmark_num,
      max(c.liked_num) as liked_num
    from public.cantonese_corpus_all c
    join terms t
      on c.data = t.term
      or lower(c.data) = lower(t.term)
      or c.data ilike t.term || '%'
      or c.data &@~ t.term
      or c.data ilike '%' || t.term || '%'
    group by c.id, c.unique_id
  )
  select id, unique_id, rank_order::integer
  from ranked
  order by
    rank_order,
    data_length,
    view_num desc,
    bookmark_num desc,
    liked_num desc
  limit 1
$$;

comment on function public.search_entry_primary(text[]) is
  'Primary entry search over precomputed query variants; ranks exact, prefix, PGroonga full text, and fuzzy matches.';
