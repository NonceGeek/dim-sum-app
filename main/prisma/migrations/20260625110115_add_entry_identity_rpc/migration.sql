create or replace function public.get_entry_identities(p_unique_ids uuid[])
returns table (
  id bigint,
  unique_id uuid,
  data text,
  note jsonb,
  structured_note jsonb,
  category text,
  category_display_name text,
  lifecycle_stage text,
  liked_num bigint,
  bookmark_num bigint,
  view_num bigint,
  created_at timestamptz,
  updated_at timestamptz,
  primary_category_id bigint,
  primary_category_slug text,
  primary_category_name text,
  secondary_category_id bigint,
  secondary_category_slug text,
  secondary_category_name text,
  related_tags jsonb,
  recommended_tags jsonb,
  contributor_ids text[]
)
language sql
stable
as $$
  with selected_rows as (
    select
      c.id,
      c.unique_id,
      c.data,
      c.note,
      c.structured_note,
      c.category,
      cc.nickname as category_display_name,
      c.lifecycle_stage,
      c.liked_num,
      c.bookmark_num,
      c.view_num,
      c.created_at,
      c.updated_at,
      parent.id as primary_category_id,
      parent.slug as primary_category_slug,
      parent.name as primary_category_name,
      child.id as secondary_category_id,
      child.slug as secondary_category_slug,
      child.name as secondary_category_name
    from public.cantonese_corpus_all c
    left join public.cantonese_categories cc on cc.name = c.category
    left join public.corpus_category cg on cg.corpus_id = c.id
    left join public.content_categories child on child.id = cg.category_id
    left join public.content_categories parent on parent.id = child.parent_id
    where c.unique_id = any(p_unique_ids)
  )
  select
    sr.id,
    sr.unique_id,
    sr.data,
    sr.note,
    sr.structured_note,
    sr.category,
    sr.category_display_name,
    sr.lifecycle_stage,
    sr.liked_num,
    sr.bookmark_num,
    sr.view_num,
    sr.created_at,
    sr.updated_at,
    sr.primary_category_id,
    sr.primary_category_slug,
    sr.primary_category_name,
    sr.secondary_category_id,
    sr.secondary_category_slug,
    sr.secondary_category_name,
    coalesce(related.related_tags, '[]'::jsonb) as related_tags,
    coalesce(recommended.recommended_tags, '[]'::jsonb) as recommended_tags,
    coalesce(contributors.contributor_ids, array[]::text[]) as contributor_ids
  from selected_rows sr
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'corpus_id', ct.corpus_id,
        'tag_id', t.id,
        'slug', t.slug,
        'name', t.name,
        'facet', t.facet
      )
      order by t.facet, t.sort_order, t.name
    ) as related_tags
    from public.corpus_tags ct
    join public.tags t on t.id = ct.tag_id
    where ct.corpus_id = sr.id
      and t.status = 'active'
  ) related on true
  left join lateral (
    with owned_tags as (
      select tag_id
      from public.corpus_tags
      where corpus_id = sr.id
    ),
    ranked_tags as (
      select
        related_tag.id as tag_id,
        related_tag.slug,
        related_tag.name,
        related_tag.facet,
        row_number() over (
          order by sum(
            case tr.method
              when 'manual' then 3.0
              when 'cooc' then 1.0
              when 'semantic' then 0.6
              else 0.4
            end * tr.score
          ) desc
        ) as rank
      from owned_tags ot
      join public.tag_related tr on tr.tag_id = ot.tag_id
      join public.tags related_tag on related_tag.id = tr.related_id
      where related_tag.status = 'active'
        and related_tag.corpus_count >= 3
        and not exists (
          select 1
          from owned_tags existing
          where existing.tag_id = tr.related_id
        )
      group by related_tag.id, related_tag.slug, related_tag.name, related_tag.facet
    )
    select jsonb_agg(
      jsonb_build_object(
        'corpus_id', sr.id,
        'tag_id', tag_id,
        'slug', slug,
        'name', name,
        'facet', facet
      )
      order by rank
    ) as recommended_tags
    from ranked_tags
    where rank <= 6
  ) recommended on true
  left join lateral (
    select array_agg(distinct h.contributor_user_id)
      filter (where h.contributor_user_id is not null) as contributor_ids
    from public.cantonese_corpus_update_history h
    where h.unique_id = sr.unique_id
  ) contributors on true
$$;

comment on function public.get_entry_identities(uuid[]) is
  'Batch entryIdentity aggregation for search, SEO, sharing, and future Supabase RPC clients.';
