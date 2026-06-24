import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildEntryIdentity,
  type CorpusSearchRow,
  type CorpusTagRow,
  type EntrySearchResponse,
} from "@/lib/search/entry-identity";
import { getQueryEmbeddingText } from "@/lib/search/query-embedding";

const SIMILAR_LIMIT = 3;
const RECOMMENDED_LIMIT = 4;

type ResultSection = "primary" | "similar" | "recommended";

type AggregatedSearchRow = CorpusSearchRow & {
  section: ResultSection;
  item_order: bigint | number;
  related_tags: CorpusTagRow[] | null;
  recommended_tags: CorpusTagRow[] | null;
  contributor_ids: string[] | null;
};

type EntrySearchSection = "all" | "primary" | "semantic";

function parseCursor(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeTags(value: CorpusTagRow[] | null): CorpusTagRow[] {
  return Array.isArray(value) ? value : [];
}

function buildResponse(params: {
  query: string;
  primaryRows?: AggregatedSearchRow[];
  semanticRows?: AggregatedSearchRow[];
  similarOffset: number;
  recommendedOffset: number;
  semanticStatus?: EntrySearchResponse["sectionStatus"]["semantic"];
}): EntrySearchResponse {
  const primaryRow = params.primaryRows?.find((row) => row.section === "primary");
  const similarRows =
    params.semanticRows?.filter((row) => row.section === "similar") ?? [];
  const recommendedRows =
    params.semanticRows?.filter((row) => row.section === "recommended") ?? [];

  const build = (row: AggregatedSearchRow) =>
    buildEntryIdentity(row, {
      relatedTags: normalizeTags(row.related_tags),
      recommendedTags: normalizeTags(row.recommended_tags),
      contributorIds: row.contributor_ids ?? [],
    });

  return {
    query: params.query,
    primary: primaryRow ? build(primaryRow) : null,
    similar: similarRows.map(build),
    recommended: recommendedRows.map(build),
    loadingSections: {
      primary: false,
      semantic: false,
    },
    sectionStatus: {
      primary: primaryRow ? "success" : "idle",
      semantic: params.semanticStatus ?? "success",
    },
    cursors: {
      similarNext:
        similarRows.length === SIMILAR_LIMIT
          ? String(params.similarOffset + SIMILAR_LIMIT)
          : null,
      recommendedNext:
        recommendedRows.length === RECOMMENDED_LIMIT
          ? String(params.recommendedOffset + RECOMMENDED_LIMIT)
          : null,
    },
  };
}

async function fetchPrimarySearchRows(query: string): Promise<AggregatedSearchRow[]> {
  return prisma.$queryRaw<AggregatedSearchRow[]>(
    Prisma.sql`
      with primary_row as (
        select
          'primary'::text as section,
          0::bigint as item_order,
          c.id,
          c.unique_id::text as unique_id,
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
        from cantonese_corpus_all c
        left join cantonese_categories cc on cc.name = c.category
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
        where c.data = ${query}
           or lower(c.data) = lower(${query})
           or c.data ilike ${`${query}%`}
           or c.data ilike ${`%${query}%`}
        order by
          case
            when c.data = ${query} then 0
            when lower(c.data) = lower(${query}) then 1
            when c.data ilike ${`${query}%`} then 2
            else 3
          end,
          length(c.data),
          c.view_num desc,
          c.bookmark_num desc,
          c.liked_num desc
        limit 1
      )
      select
        pr.*,
        coalesce(related.related_tags, '[]'::jsonb) as related_tags,
        coalesce(recommended.recommended_tags, '[]'::jsonb) as recommended_tags,
        coalesce(contributors.contributor_ids, array[]::text[]) as contributor_ids
      from primary_row pr
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
        from corpus_tags ct
        join tags t on t.id = ct.tag_id
        where ct.corpus_id = pr.id
          and t.status = 'active'
      ) related on true
      left join lateral (
        with owned_tags as (
          select tag_id
          from corpus_tags
          where corpus_id = pr.id
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
          join tag_related tr on tr.tag_id = ot.tag_id
          join tags related_tag on related_tag.id = tr.related_id
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
            'corpus_id', pr.id,
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
        from cantonese_corpus_update_history h
        where h.unique_id = pr.unique_id::uuid
      ) contributors on true
    `,
  );
}

async function fetchAggregatedSearchRows(params: {
  query: string;
  similarOffset: number;
  recommendedOffset: number;
}): Promise<AggregatedSearchRow[]> {
  return prisma.$queryRaw<AggregatedSearchRow[]>(
    Prisma.sql`
      with primary_row as (
        select
          c.id,
          c.unique_id::text as unique_id,
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
        from cantonese_corpus_all c
        left join cantonese_categories cc on cc.name = c.category
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
        where c.data = ${params.query}
           or lower(c.data) = lower(${params.query})
           or c.data ilike ${`${params.query}%`}
           or c.data ilike ${`%${params.query}%`}
        order by
          case
            when c.data = ${params.query} then 0
            when lower(c.data) = lower(${params.query}) then 1
            when c.data ilike ${`${params.query}%`} then 2
            else 3
          end,
          length(c.data),
          c.view_num desc,
          c.bookmark_num desc,
          c.liked_num desc
        limit 1
      ),
      primary_tags as (
        select ct.tag_id
        from corpus_tags ct
        join primary_row p on p.id = ct.corpus_id
      ),
      similar_candidates as (
        select id, score
        from (
          select
            e.corpus_id as id,
            (
              1 - (
                e.embedding <=> (
                  select src.embedding
                  from corpus_field_embeddings src
                  where src.corpus_id = (select id from primary_row)
                    and src.field_type = 'doc'
                  limit 1
                )
              )
            ) * 90 as score
          from corpus_field_embeddings e
          where e.field_type = 'doc'
            and e.corpus_id <> (select id from primary_row)
            and (
              select src.embedding
              from corpus_field_embeddings src
              where src.corpus_id = (select id from primary_row)
                and src.field_type = 'doc'
              limit 1
            ) is not null
          order by e.embedding <=> (
            select src.embedding
            from corpus_field_embeddings src
            where src.corpus_id = (select id from primary_row)
              and src.field_type = 'doc'
            limit 1
          )
          limit 12
        ) vector_candidates

        union all

        select ct.corpus_id as id, 60 as score
        from corpus_tags ct
        where ct.tag_id in (select tag_id from primary_tags)
          and ct.corpus_id <> (select id from primary_row)

        union all

        select cg.corpus_id as id, 40 as score
        from corpus_category cg
        where cg.category_id = (select secondary_category_id from primary_row)
          and cg.corpus_id <> (select id from primary_row)
      ),
      similar_ranked as (
        select
          c.id,
          row_number() over (
            order by
              sum(sc.score) + ln(c.view_num::float + 1) desc,
              c.bookmark_num desc,
              c.liked_num desc
          ) as item_order
        from similar_candidates sc
        join cantonese_corpus_all c on c.id = sc.id
        group by c.id, c.view_num, c.bookmark_num, c.liked_num
      ),
      similar_ids as (
        select id, item_order
        from similar_ranked
        order by item_order
        limit ${SIMILAR_LIMIT}
        offset ${params.similarOffset}
      ),
      recommended_candidates as (
        select id, score
        from (
          select
            e.corpus_id as id,
            (
              1 - (
                e.embedding <=> (
                  select src.embedding
                  from corpus_field_embeddings src
                  where src.corpus_id = (select id from primary_row)
                    and src.field_type = 'doc'
                  limit 1
                )
              )
            ) * 20 as score
          from corpus_field_embeddings e
          where e.field_type = 'doc'
            and e.corpus_id <> (select id from primary_row)
            and (
              select src.embedding
              from corpus_field_embeddings src
              where src.corpus_id = (select id from primary_row)
                and src.field_type = 'doc'
              limit 1
            ) is not null
          order by e.embedding <=> (
            select src.embedding
            from corpus_field_embeddings src
            where src.corpus_id = (select id from primary_row)
              and src.field_type = 'doc'
            limit 1
          )
          limit 24
        ) vector_candidates

        union all

        select c.id,
               sum(
                 case tr.method
                   when 'manual' then 300.0
                   when 'cooc' then 100.0
                   when 'semantic' then 60.0
                   else 40.0
                 end * tr.score
               ) as score
        from tag_related tr
        join corpus_tags ct on ct.tag_id = tr.related_id
        join cantonese_corpus_all c on c.id = ct.corpus_id
        where tr.tag_id in (select tag_id from primary_tags)
          and c.id <> (select id from primary_row)
        group by c.id

        union all

        select c.id,
               ln(c.view_num::float + 1) + 5 as score
        from cantonese_corpus_all c
        join corpus_category cg on cg.corpus_id = c.id
        where cg.category_id = (select secondary_category_id from primary_row)
          and c.id <> (select id from primary_row)

        union all

        select c.id,
               ln(c.view_num::float + 1) + 2 as score
        from cantonese_corpus_all c
        join corpus_category cg on cg.corpus_id = c.id
        join content_categories child on child.id = cg.category_id
        where child.parent_id = (select primary_category_id from primary_row)
          and c.id <> (select id from primary_row)
      ),
      recommended_ranked as (
        select
          c.id,
          row_number() over (
            order by
              sum(rc.score) desc,
              c.view_num desc,
              c.bookmark_num desc,
              c.liked_num desc
          ) as item_order
        from recommended_candidates rc
        join cantonese_corpus_all c on c.id = rc.id
        where not exists (
          select 1 from similar_ids s where s.id = c.id
        )
        group by c.id, c.view_num, c.bookmark_num, c.liked_num
      ),
      recommended_ids as (
        select id, item_order
        from recommended_ranked
        order by item_order
        limit ${RECOMMENDED_LIMIT}
        offset ${params.recommendedOffset}
      ),
      result_ids as (
        select 'primary'::text as section, 0::bigint as item_order, id
        from primary_row

        union all

        select 'similar'::text as section, item_order, id
        from similar_ids

        union all

        select 'recommended'::text as section, item_order, id
        from recommended_ids
      ),
      result_rows as (
        select
          r.section,
          r.item_order,
          c.id,
          c.unique_id::text as unique_id,
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
        from result_ids r
        join cantonese_corpus_all c on c.id = r.id
        left join cantonese_categories cc on cc.name = c.category
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
      )
      select
        rr.*,
        coalesce(related.related_tags, '[]'::jsonb) as related_tags,
        coalesce(recommended.recommended_tags, '[]'::jsonb) as recommended_tags,
        coalesce(contributors.contributor_ids, array[]::text[]) as contributor_ids
      from result_rows rr
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
        from corpus_tags ct
        join tags t on t.id = ct.tag_id
        where ct.corpus_id = rr.id
          and t.status = 'active'
      ) related on true
      left join lateral (
        with owned_tags as (
          select tag_id
          from corpus_tags
          where corpus_id = rr.id
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
          join tag_related tr on tr.tag_id = ot.tag_id
          join tags related_tag on related_tag.id = tr.related_id
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
            'corpus_id', rr.id,
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
        from cantonese_corpus_update_history h
        where h.unique_id = rr.unique_id::uuid
      ) contributors on true
      order by
        case rr.section
          when 'primary' then 0
          when 'similar' then 1
          else 2
        end,
        rr.item_order
    `,
  );
}

async function fetchSemanticSearchRows(params: {
  query: string;
  queryEmbeddingText: string;
  similarOffset: number;
  recommendedOffset: number;
}): Promise<AggregatedSearchRow[]> {
  return prisma.$queryRaw<AggregatedSearchRow[]>(
    Prisma.sql`
      with primary_seed as (
        select
          c.id,
          child.id as secondary_category_id,
          parent.id as primary_category_id
        from cantonese_corpus_all c
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
        where c.data = ${params.query}
           or lower(c.data) = lower(${params.query})
           or c.data ilike ${`${params.query}%`}
           or c.data ilike ${`%${params.query}%`}
        order by
          case
            when c.data = ${params.query} then 0
            when lower(c.data) = lower(${params.query}) then 1
            when c.data ilike ${`${params.query}%`} then 2
            else 3
          end,
          length(c.data),
          c.view_num desc,
          c.bookmark_num desc,
          c.liked_num desc
        limit 1
      ),
      primary_tags as (
        select ct.tag_id
        from corpus_tags ct
        join primary_seed p on p.id = ct.corpus_id
      ),
      semantic_candidates as (
        select id, score
        from (
          select
            e.corpus_id as id,
            (1 - (e.embedding <=> ${params.queryEmbeddingText}::vector)) * 100 as score
          from corpus_field_embeddings e
          where e.field_type = 'doc'
            and e.corpus_id <> coalesce((select id from primary_seed), -1)
          order by e.embedding <=> ${params.queryEmbeddingText}::vector
          limit 48
        ) vector_candidates
      ),
      similar_candidates as (
        select id, score
        from semantic_candidates

        union all

        select ct.corpus_id as id, 35 as score
        from corpus_tags ct
        where ct.tag_id in (select tag_id from primary_tags)
          and ct.corpus_id <> coalesce((select id from primary_seed), -1)

        union all

        select cg.corpus_id as id, 25 as score
        from corpus_category cg
        where cg.category_id = (select secondary_category_id from primary_seed)
          and cg.corpus_id <> coalesce((select id from primary_seed), -1)
      ),
      similar_ranked as (
        select
          c.id,
          row_number() over (
            order by
              sum(sc.score) + ln(c.view_num::float + 1) desc,
              c.bookmark_num desc,
              c.liked_num desc
          ) as item_order
        from similar_candidates sc
        join cantonese_corpus_all c on c.id = sc.id
        group by c.id, c.view_num, c.bookmark_num, c.liked_num
      ),
      similar_ids as (
        select id, item_order
        from similar_ranked
        order by item_order
        limit ${SIMILAR_LIMIT}
        offset ${params.similarOffset}
      ),
      recommended_candidates as (
        select id, score * 0.35 as score
        from semantic_candidates

        union all

        select c.id,
               sum(
                 case tr.method
                   when 'manual' then 300.0
                   when 'cooc' then 100.0
                   when 'semantic' then 60.0
                   else 40.0
                 end * tr.score
               ) as score
        from tag_related tr
        join corpus_tags ct on ct.tag_id = tr.related_id
        join cantonese_corpus_all c on c.id = ct.corpus_id
        where tr.tag_id in (select tag_id from primary_tags)
          and c.id <> coalesce((select id from primary_seed), -1)
        group by c.id

        union all

        select c.id,
               ln(c.view_num::float + 1) + 5 as score
        from cantonese_corpus_all c
        join corpus_category cg on cg.corpus_id = c.id
        where cg.category_id = (select secondary_category_id from primary_seed)
          and c.id <> coalesce((select id from primary_seed), -1)

        union all

        select c.id,
               ln(c.view_num::float + 1) + 2 as score
        from cantonese_corpus_all c
        join corpus_category cg on cg.corpus_id = c.id
        join content_categories child on child.id = cg.category_id
        where child.parent_id = (select primary_category_id from primary_seed)
          and c.id <> coalesce((select id from primary_seed), -1)
      ),
      recommended_ranked as (
        select
          c.id,
          row_number() over (
            order by
              sum(rc.score) desc,
              c.view_num desc,
              c.bookmark_num desc,
              c.liked_num desc
          ) as item_order
        from recommended_candidates rc
        join cantonese_corpus_all c on c.id = rc.id
        where not exists (
          select 1 from similar_ids s where s.id = c.id
        )
        group by c.id, c.view_num, c.bookmark_num, c.liked_num
      ),
      recommended_ids as (
        select id, item_order
        from recommended_ranked
        order by item_order
        limit ${RECOMMENDED_LIMIT}
        offset ${params.recommendedOffset}
      ),
      result_ids as (
        select 'similar'::text as section, item_order, id
        from similar_ids

        union all

        select 'recommended'::text as section, item_order, id
        from recommended_ids
      ),
      result_rows as (
        select
          r.section,
          r.item_order,
          c.id,
          c.unique_id::text as unique_id,
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
        from result_ids r
        join cantonese_corpus_all c on c.id = r.id
        left join cantonese_categories cc on cc.name = c.category
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
      )
      select
        rr.*,
        coalesce(related.related_tags, '[]'::jsonb) as related_tags,
        coalesce(recommended.recommended_tags, '[]'::jsonb) as recommended_tags,
        coalesce(contributors.contributor_ids, array[]::text[]) as contributor_ids
      from result_rows rr
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
        from corpus_tags ct
        join tags t on t.id = ct.tag_id
        where ct.corpus_id = rr.id
          and t.status = 'active'
      ) related on true
      left join lateral (
        with owned_tags as (
          select tag_id
          from corpus_tags
          where corpus_id = rr.id
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
          join tag_related tr on tr.tag_id = ot.tag_id
          join tags related_tag on related_tag.id = tr.related_id
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
            'corpus_id', rr.id,
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
        from cantonese_corpus_update_history h
        where h.unique_id = rr.unique_id::uuid
      ) contributors on true
      order by
        case rr.section
          when 'similar' then 1
          else 2
        end,
        rr.item_order
    `,
  );
}

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();
    const sectionParam = searchParams.get("section");
    const section: EntrySearchSection =
      sectionParam === "primary" || sectionParam === "semantic"
        ? sectionParam
        : "all";
    const similarOffset = parseCursor(searchParams.get("similarCursor"));
    const recommendedOffset = parseCursor(searchParams.get("recommendedCursor"));

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 },
      );
    }

    const fetchSemantic = async (): Promise<{
      rows: AggregatedSearchRow[];
      status: EntrySearchResponse["sectionStatus"]["semantic"];
    }> => {
      try {
        const queryEmbeddingText = await getQueryEmbeddingText(query);

        if (!queryEmbeddingText) {
          const fallbackRows = await fetchAggregatedSearchRows({
            query,
            similarOffset,
            recommendedOffset,
          });
          return {
            rows: fallbackRows.filter((row) => row.section !== "primary"),
            status: "fallback",
          };
        }

        return {
          rows: await fetchSemanticSearchRows({
            query,
            queryEmbeddingText,
            similarOffset,
            recommendedOffset,
          }),
          status: "success",
        };
      } catch (error) {
        console.error("Semantic entry search failed:", error);
        const fallbackRows = await fetchAggregatedSearchRows({
          query,
          similarOffset,
          recommendedOffset,
        });
        return {
          rows: fallbackRows.filter((row) => row.section !== "primary"),
          status: "fallback",
        };
      }
    };

    if (section === "primary") {
      const primaryRows = await fetchPrimarySearchRows(query);
      return NextResponse.json(
        buildResponse({
          query,
          primaryRows,
          similarOffset,
          recommendedOffset,
          semanticStatus: "idle",
        }),
      );
    }

    if (section === "semantic") {
      const semantic = await fetchSemantic();
      return NextResponse.json(
        buildResponse({
          query,
          semanticRows: semantic.rows,
          similarOffset,
          recommendedOffset,
          semanticStatus: semantic.status,
        }),
      );
    }

    const [primaryRows, semantic] = await Promise.all([
      fetchPrimarySearchRows(query),
      fetchSemantic(),
    ]);

    return NextResponse.json(
      buildResponse({
        query,
        primaryRows,
        semanticRows: semantic.rows,
        similarOffset,
        recommendedOffset,
        semanticStatus: semantic.status,
      }),
    );
  });
}
