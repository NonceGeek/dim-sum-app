import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as OpenCC from "opencc-js";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  databaseErrorResponse,
  isPrismaStatementTimeout,
  isPrismaTransientDatabaseError,
} from "@/lib/prisma-errors";
import {
  buildEntryIdentity,
  type CorpusSearchRow,
  type CorpusTagRow,
  type EntrySearchResponse,
} from "@/lib/search/entry-identity";
import { getQueryEmbeddingText } from "@/lib/search/query-embedding";

const SIMILAR_LIMIT = 3;
const RECOMMENDED_LIMIT = 4;
const SEMANTIC_STATEMENT_TIMEOUT_MS = 8_000;
const OFFLINE_NEIGHBORS_ENABLED =
  process.env.SEARCH_OFFLINE_NEIGHBORS_ENABLED === "true";
const OFFLINE_NEIGHBORS_WEIGHT = parsePositiveIntegerEnvironment(
  process.env.SEARCH_OFFLINE_NEIGHBORS_WEIGHT,
  45,
  100,
);
const OFFLINE_NEIGHBORS_MAX_RANK = parsePositiveIntegerEnvironment(
  process.env.SEARCH_OFFLINE_NEIGHBORS_MAX_RANK,
  24,
  32,
);
const SEARCH_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;
const SEARCH_NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });

type ResultSection = "primary" | "similar" | "recommended";

type AggregatedSearchRow = CorpusSearchRow & {
  section: ResultSection;
  item_order: bigint | number;
  related_tags: CorpusTagRow[] | null;
  recommended_tags: CorpusTagRow[] | null;
  contributor_ids: string[] | null;
};

type EntrySearchSection = "all" | "primary" | "semantic";
type SemanticPart = "all" | "similar" | "recommended";

function parsePositiveIntegerEnvironment(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function parseCursor(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseDatasets(value: string | null): string[] | null {
  if (!value) return null;

  const datasets = Array.from(
    new Set(value.split(",").map((dataset) => dataset.trim()).filter(Boolean)),
  );

  return !datasets.length || datasets.includes("all") ? null : datasets;
}

function normalizeTags(value: CorpusTagRow[] | null): CorpusTagRow[] {
  return Array.isArray(value) ? value : [];
}

function getPrimarySearchTerms(query: string): string[] {
  const normalized = query.trim();
  return Array.from(
    new Set(
      [normalized, toSimplified(normalized), toTraditional(normalized)]
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  );
}

function orJoin(parts: Prisma.Sql[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(parts, " or ")})`;
}

function buildPrimaryMatchCondition(query: string): Prisma.Sql {
  const terms = getPrimarySearchTerms(query);
  const lowerTerms = terms.map((term) => term.toLowerCase());
  const prefixParts = terms.map((term) => Prisma.sql`c.data ilike ${`${term}%`}`);
  const likeParts = terms.map((term) => Prisma.sql`c.data ilike ${`%${term}%`}`);
  const fullTextParts = terms.map((term) => Prisma.sql`c.data &@~ ${term}`);

  return orJoin([
    Prisma.sql`c.data in (${Prisma.join(terms)})`,
    Prisma.sql`lower(c.data) in (${Prisma.join(lowerTerms)})`,
    ...prefixParts,
    ...likeParts,
    ...fullTextParts,
  ]);
}

function buildPrimaryRankCase(query: string): Prisma.Sql {
  const terms = getPrimarySearchTerms(query);
  const lowerTerms = terms.map((term) => term.toLowerCase());
  const prefixParts = terms.map((term) => Prisma.sql`c.data ilike ${`${term}%`}`);
  const fullTextParts = terms.map((term) => Prisma.sql`c.data &@~ ${term}`);

  return Prisma.sql`
    case
      when c.data in (${Prisma.join(terms)}) then 0
      when lower(c.data) in (${Prisma.join(lowerTerms)}) then 1
      when ${orJoin(prefixParts)} then 2
      when ${orJoin(fullTextParts)} then 3
      else 4
    end
  `;
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

async function fetchPrimarySearchRows(
  query: string,
  datasets: string[] | null,
): Promise<AggregatedSearchRow[]> {
  const terms = getPrimarySearchTerms(query);
  const datasetFilter = datasets?.length
    ? Prisma.sql`array[${Prisma.join(datasets)}]::text[]`
    : Prisma.sql`null::text[]`;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'");
      return tx.$queryRaw<AggregatedSearchRow[]>(
        Prisma.sql`
      with primary_match as (
        select unique_id
        from public.search_entry_primary(
          array[${Prisma.join(terms)}]::text[],
          ${datasetFilter}
        )
      )
      select
        'primary'::text as section,
        0::bigint as item_order,
        entry.id,
        entry.unique_id::text as unique_id,
        entry.data,
        entry.note,
        entry.structured_note,
        entry.category,
        entry.category_display_name,
        entry.editable_level,
        entry.lifecycle_stage,
        entry.liked_num,
        entry.bookmark_num,
        entry.view_num,
        entry.created_at,
        entry.updated_at,
        entry.primary_category_id,
        entry.primary_category_slug,
        entry.primary_category_name,
        entry.secondary_category_id,
        entry.secondary_category_slug,
        entry.secondary_category_name,
        entry.related_tags,
        entry.recommended_tags,
        entry.contributor_ids
      from primary_match pm
      join lateral public.get_entry_identities(array[pm.unique_id]::uuid[]) entry
        on true
        `,
      );
    },
    { maxWait: 2_000, timeout: 7_000 },
  );
}

async function fetchAggregatedSearchRows(params: {
  query: string;
  similarOffset: number;
  recommendedOffset: number;
}): Promise<AggregatedSearchRow[]> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL statement_timeout = '${SEMANTIC_STATEMENT_TIMEOUT_MS}ms'`,
      );
      return tx.$queryRaw<AggregatedSearchRow[]>(Prisma.sql`
      with primary_row as (
        select
          c.id,
          c.unique_id::text as unique_id,
          c.data,
          c.note,
          c.structured_note,
          c.category,
          cc.nickname as category_display_name,
          cc.editable_level as editable_level,
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
        where ${buildPrimaryMatchCondition(params.query)}
        order by
          ${buildPrimaryRankCase(params.query)},
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
          cc.editable_level as editable_level,
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
    `);
    },
    { maxWait: 2_000, timeout: SEMANTIC_STATEMENT_TIMEOUT_MS + 2_000 },
  );
}

async function fetchSemanticSearchRows(params: {
  query: string;
  queryEmbeddingText: string;
  primaryCorpusId: bigint | null | undefined;
  similarOffset: number;
  recommendedOffset: number;
  semanticPart: SemanticPart;
}): Promise<AggregatedSearchRow[]> {
  const primarySeedCondition =
    params.primaryCorpusId === null
      ? Prisma.sql`false`
      : params.primaryCorpusId !== undefined
        ? Prisma.sql`c.id = ${params.primaryCorpusId}`
        : buildPrimaryMatchCondition(params.query);
  const resultIds =
    params.semanticPart === "similar"
      ? Prisma.sql`
          select 'similar'::text as section, item_order, id
          from similar_ids
        `
      : params.semanticPart === "recommended"
        ? Prisma.sql`
            select 'recommended'::text as section, item_order, id
            from recommended_ids
          `
        : Prisma.sql`
            select 'similar'::text as section, item_order, id
            from similar_ids

            union all

            select 'recommended'::text as section, item_order, id
            from recommended_ids
          `;
  // Keep the table reference out of generated SQL until the migration has been
  // applied and an active build exists. This makes deployment order reversible.
  const offlineNeighborCandidates = OFFLINE_NEIGHBORS_ENABLED
    ? Prisma.sql`
        union all

        select
          n.target_corpus_id as id,
          n.similarity * ${OFFLINE_NEIGHBORS_WEIGHT} as score
        from similar_ids s
        join corpus_embedding_neighbor_builds b
          on b.field_type = 'doc'
         and b.status = 'active'
        join corpus_embedding_neighbors n
          on n.build_id = b.id
         and n.field_type = b.field_type
         and n.source_corpus_id = s.id
        where n.rank <= ${OFFLINE_NEIGHBORS_MAX_RANK}
          and n.target_corpus_id <> coalesce((select id from primary_seed), -1)
      `
    : Prisma.empty;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL statement_timeout = '${SEMANTIC_STATEMENT_TIMEOUT_MS}ms'`,
      );
      return tx.$queryRaw<AggregatedSearchRow[]>(Prisma.sql`
      with primary_seed as (
        select
          c.id,
          child.id as secondary_category_id,
          parent.id as primary_category_id
        from cantonese_corpus_all c
        left join corpus_category cg on cg.corpus_id = c.id
        left join content_categories child on child.id = cg.category_id
        left join content_categories parent on parent.id = child.parent_id
        where ${primarySeedCondition}
        order by
          ${buildPrimaryRankCase(params.query)},
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

        ${offlineNeighborCandidates}

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
        ${resultIds}
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
          cc.editable_level as editable_level,
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
    `);
    },
    { maxWait: 2_000, timeout: SEMANTIC_STATEMENT_TIMEOUT_MS + 2_000 },
  );
}

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();
    const datasets = parseDatasets(searchParams.get("dataset"));
    const sectionParam = searchParams.get("section");
    const section: EntrySearchSection =
      sectionParam === "primary" || sectionParam === "semantic"
        ? sectionParam
        : "all";
    const semanticPartParam = searchParams.get("semanticPart");
    const semanticPart: SemanticPart =
      semanticPartParam === "similar" || semanticPartParam === "recommended"
        ? semanticPartParam
        : "all";
    const primaryCorpusIdParam = searchParams.get("primaryCorpusId");
    let primaryCorpusId: bigint | null | undefined;
    if (primaryCorpusIdParam === "none") {
      primaryCorpusId = null;
    } else if (primaryCorpusIdParam !== null) {
      if (!/^[1-9]\d*$/.test(primaryCorpusIdParam)) {
        return NextResponse.json(
          { error: "Invalid primaryCorpusId" },
          { status: 400 },
        );
      }
      primaryCorpusId = BigInt(primaryCorpusIdParam);
    }
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
      const filterRows = (rows: AggregatedSearchRow[]) =>
        rows.filter(
          (row) => semanticPart === "all" || row.section === semanticPart,
        );
      const fetchFallback = async () => {
        const fallbackRows = await fetchAggregatedSearchRows({
          query,
          similarOffset,
          recommendedOffset,
        });
        return {
          rows: filterRows(
            fallbackRows.filter((row) => row.section !== "primary"),
          ),
          status: "fallback" as const,
        };
      };

      let queryEmbeddingText: string | null = null;
      try {
        queryEmbeddingText = await getQueryEmbeddingText(query);
      } catch (error) {
        console.error("Query embedding failed; using search fallback:", error);
      }

      if (queryEmbeddingText) {
        try {
          const rows = await fetchSemanticSearchRows({
            query,
            queryEmbeddingText,
            primaryCorpusId,
            similarOffset,
            recommendedOffset,
            semanticPart,
          });

          return {
            rows: filterRows(rows),
            status: "success",
          };
        } catch (error) {
          console.error("Semantic entry search failed:", error);
          if (isPrismaStatementTimeout(error) && semanticPart === "all") {
            try {
              const similarRows = await fetchSemanticSearchRows({
                query,
                queryEmbeddingText,
                primaryCorpusId,
                similarOffset,
                recommendedOffset,
                semanticPart: "similar",
              });
              return { rows: similarRows, status: "fallback" };
            } catch (similarError) {
              console.error("Similar-only semantic fallback failed:", similarError);
            }
          }
          if (isPrismaTransientDatabaseError(error)) {
            return { rows: [], status: "error" };
          }
        }
      }

      try {
        return await fetchFallback();
      } catch (error) {
        console.error("Entry search fallback failed:", error);
        if (isPrismaTransientDatabaseError(error)) {
          return { rows: [], status: "error" };
        }
        throw error;
      }
    };

    if (section === "primary") {
      try {
        const primaryRows = await fetchPrimarySearchRows(query, datasets);
        return NextResponse.json(
          buildResponse({
            query,
            primaryRows,
            similarOffset,
            recommendedOffset,
            semanticStatus: "idle",
          }),
          { headers: SEARCH_CACHE_HEADERS },
        );
      } catch (error) {
        console.error("Primary entry search failed:", error);
        return databaseErrorResponse(error, "Entry primary search failed");
      }
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
        {
          headers:
            semantic.status === "error"
              ? SEARCH_NO_STORE_HEADERS
              : SEARCH_CACHE_HEADERS,
        },
      );
    }

    const [primaryRows, semantic] = await Promise.all([
      fetchPrimarySearchRows(query, datasets),
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
      {
        headers:
          semantic.status === "error"
            ? SEARCH_NO_STORE_HEADERS
            : SEARCH_CACHE_HEADERS,
      },
    );
  });
}
