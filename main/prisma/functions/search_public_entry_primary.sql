-- Managed independently of Prisma db pull/db push: those commands do not sync
-- function bodies. This adds a public-only RPC; search_entry_primary is untouched.
create or replace function public.search_public_entry_primary(
  p_query_variants text[],
  p_categories text[] default null,
  p_content_attribute text default null
)
returns table (id bigint, unique_id uuid, rank_order integer)
language plpgsql
stable
rows 1
security invoker
set search_path = pg_catalog, public, extensions
as $function$
declare
  query_terms text[];
  allowed_categories text[];
  stage integer;
  predicate text;
  matched_rows bigint;
begin
  select array_agg(distinct btrim(term))
    into query_terms
    from unnest(p_query_variants) as terms(term)
    where term is not null and btrim(term) <> '';
  if coalesce(cardinality(query_terms), 0) = 0 then
    return;
  end if;

  if p_content_attribute is not null
     and p_content_attribute not in ('oral', 'cultural_knowledge') then
    raise exception 'Invalid content attribute' using errcode = '22023';
  end if;

  -- NULL means all PUBLIC datasets. An empty input/intersection means no rows.
  -- STABLE uses the calling statement's snapshot for both scope and corpus reads.
  select array_agg(ds.name)
    into allowed_categories
    from public.cantonese_categories ds
    where ds.is_public = true
      and (p_categories is null or ds.name = any(p_categories))
      and (p_content_attribute is null or ds.content_attribute = p_content_attribute);
  if coalesce(cardinality(allowed_categories), 0) = 0 then
    return;
  end if;

  -- Preserve exact -> case-insensitive -> prefix -> full text -> contains.
  -- Stop after the first successful tier, rather than evaluating a broad OR
  -- over the entire corpus. EXECUTE replans each tier for its actual terms.
  for stage in 0..4 loop
    select string_agg(
      case stage
        when 0 then format('c.data = %L', term)
        when 1 then format('lower(c.data) = lower(%L)', term)
        when 2 then format('c.data ilike %L', term || '%')
        when 3 then format('c.data &@~ %L', term)
        else format('c.data ilike %L', '%' || term || '%')
      end, ' or '
    ) into predicate from unnest(query_terms) as terms(term);

    -- Query terms are SQL literals (%L), never executable SQL fragments.
    -- Dataset values stay bound parameters. The id tie-break makes equal ranks
    -- deterministic while preserving all existing ranking priorities.
    return query execute format(
      'select c.id, c.unique_id, %s::integer
       from public.cantonese_corpus_all c
       where c.category = any($1) and (%s)
       order by length(c.data), c.view_num desc, c.bookmark_num desc,
                c.liked_num desc, c.id asc
       limit 1', stage, predicate
    ) using allowed_categories;
    get diagnostics matched_rows = row_count;
    if matched_rows > 0 then
      return;
    end if;
  end loop;
end
$function$;
