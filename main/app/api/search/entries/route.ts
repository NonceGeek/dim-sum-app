import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildEntryIdentity,
  groupContributorsByUniqueId,
  groupTagsByCorpus,
  type ContributorRow,
  type CorpusSearchRow,
  type CorpusTagRow,
  type EntrySearchResponse,
} from "@/lib/search/entry-identity";

const SIMILAR_LIMIT = 3;
const RECOMMENDED_LIMIT = 4;

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

function parseCursor(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function corpusSelectSql() {
  return Prisma.sql`
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
  `;
}

function corpusJoinSql() {
  return Prisma.sql`
    left join cantonese_categories cc on cc.name = c.category
    left join corpus_category cg on cg.corpus_id = c.id
    left join content_categories child on child.id = cg.category_id
    left join content_categories parent on parent.id = child.parent_id
  `;
}

async function fetchPrimary(query: string): Promise<CorpusSearchRow | null> {
  const rows = await prisma.$queryRaw<CorpusSearchRow[]>(
    Prisma.sql`
      select ${corpusSelectSql()}
      from cantonese_corpus_all c
      ${corpusJoinSql()}
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
    `,
  );

  return rows[0] ?? null;
}

async function fetchRowsByIds(ids: number[]): Promise<CorpusSearchRow[]> {
  if (!ids.length) return [];

  return prisma.$queryRaw<CorpusSearchRow[]>(
    Prisma.sql`
      select ${corpusSelectSql()}
      from cantonese_corpus_all c
      ${corpusJoinSql()}
      where c.id in (${Prisma.join(ids)})
      order by array_position(array[${Prisma.join(ids)}]::bigint[], c.id)
    `,
  );
}

async function fetchTagsForCorpusIds(ids: number[]): Promise<CorpusTagRow[]> {
  if (!ids.length) return [];

  return prisma.$queryRaw<CorpusTagRow[]>(
    Prisma.sql`
      select
        ct.corpus_id,
        t.id as tag_id,
        t.slug,
        t.name,
        t.facet
      from corpus_tags ct
      join tags t on t.id = ct.tag_id
      where ct.corpus_id in (${Prisma.join(ids)})
        and t.status = 'active'
      order by ct.corpus_id, t.facet, t.sort_order, t.name
    `,
  );
}

async function fetchRecommendedTagsForCorpusIds(
  ids: number[],
): Promise<CorpusTagRow[]> {
  if (!ids.length) return [];

  return prisma.$queryRaw<CorpusTagRow[]>(
    Prisma.sql`
      with owned_tags as (
        select corpus_id, tag_id
        from corpus_tags
        where corpus_id in (${Prisma.join(ids)})
      ),
      ranked_tags as (
        select
          ot.corpus_id,
          related.id as tag_id,
          related.slug,
          related.name,
          related.facet,
          row_number() over (
            partition by ot.corpus_id
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
        join tags related on related.id = tr.related_id
        where related.status = 'active'
          and not exists (
            select 1
            from owned_tags existing
            where existing.corpus_id = ot.corpus_id
              and existing.tag_id = tr.related_id
          )
        group by ot.corpus_id, related.id, related.slug, related.name, related.facet
      )
      select corpus_id, tag_id, slug, name, facet
      from ranked_tags
      where rank <= 6
      order by corpus_id, rank
    `,
  );
}

async function fetchContributors(uniqueIds: string[]): Promise<ContributorRow[]> {
  if (!uniqueIds.length) return [];

  return prisma.$queryRaw<ContributorRow[]>(
    Prisma.sql`
      select
        h.unique_id::text as unique_id,
        array_agg(distinct h.contributor_user_id)
          filter (where h.contributor_user_id is not null) as contributor_ids
      from cantonese_corpus_update_history h
      where h.unique_id::text in (${Prisma.join(uniqueIds)})
      group by h.unique_id
    `,
  );
}

async function fetchSimilarIds(params: {
  primaryId: number;
  primaryTagIds: number[];
  secondaryCategoryId: number | null;
  offset: number;
}): Promise<number[]> {
  const tagCondition = params.primaryTagIds.length
    ? Prisma.sql`ct.tag_id in (${Prisma.join(params.primaryTagIds)})`
    : Prisma.sql`false`;
  const categoryCondition = params.secondaryCategoryId
    ? Prisma.sql`cg.category_id = ${params.secondaryCategoryId}`
    : Prisma.sql`false`;

  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(
    Prisma.sql`
      select c.id
      from cantonese_corpus_all c
      left join corpus_tags ct on ct.corpus_id = c.id
      left join corpus_category cg on cg.corpus_id = c.id
      where c.id <> ${params.primaryId}
        and (${tagCondition} or ${categoryCondition})
      group by c.id
      order by
        count(distinct case when ${tagCondition} then ct.tag_id end) * 60
        + max(case when ${categoryCondition} then 40 else 0 end)
        + ln(max(c.view_num)::float + 1) desc,
        max(c.bookmark_num) desc,
        max(c.liked_num) desc
      limit ${SIMILAR_LIMIT}
      offset ${params.offset}
    `,
  );

  return rows.map((row) => Number(row.id));
}

async function fetchRecommendedIds(params: {
  primaryId: number;
  excludeIds: number[];
  primaryTagIds: number[];
  primaryCategoryName: string;
  offset: number;
}): Promise<number[]> {
  const excluded = Array.from(new Set([params.primaryId, ...params.excludeIds]));
  const relatedIds: number[] = [];

  if (params.primaryTagIds.length) {
    const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(
      Prisma.sql`
        select c.id
        from tag_related tr
        join corpus_tags ct on ct.tag_id = tr.related_id
        join cantonese_corpus_all c on c.id = ct.corpus_id
        where tr.tag_id in (${Prisma.join(params.primaryTagIds)})
          and c.id not in (${Prisma.join(excluded)})
        group by c.id
        order by
          sum(
            case tr.method
              when 'manual' then 3.0
              when 'cooc' then 1.0
              when 'semantic' then 0.6
              else 0.4
            end * tr.score
          ) desc,
          max(c.view_num) desc,
          max(c.bookmark_num) desc
        limit ${RECOMMENDED_LIMIT}
        offset ${params.offset}
      `,
    );

    relatedIds.push(...rows.map((row) => Number(row.id)));

    if (relatedIds.length >= RECOMMENDED_LIMIT) return relatedIds;
  }

  const fallbackExcluded = Array.from(new Set([...excluded, ...relatedIds]));
  const fallbackLimit = RECOMMENDED_LIMIT - relatedIds.length;
  const fallbackRows = await prisma.$queryRaw<Array<{ id: bigint }>>(
    Prisma.sql`
      select c.id
      from cantonese_corpus_all c
      where c.category = ${params.primaryCategoryName}
        and c.id not in (${Prisma.join(fallbackExcluded)})
      order by c.view_num desc, c.bookmark_num desc, c.liked_num desc
      limit ${fallbackLimit}
      offset ${params.offset}
    `,
  );

  return [...relatedIds, ...fallbackRows.map((row) => Number(row.id))];
}

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();
    const similarOffset = parseCursor(searchParams.get("similarCursor"));
    const recommendedOffset = parseCursor(searchParams.get("recommendedCursor"));

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 },
      );
    }

    const primaryRow = await fetchPrimary(query);

    if (!primaryRow) {
      const emptyResponse: EntrySearchResponse = {
        query,
        primary: null,
        similar: [],
        recommended: [],
        cursors: {
          similarNext: null,
          recommendedNext: null,
        },
      };
      return NextResponse.json(emptyResponse);
    }

    const primaryId = toNumber(primaryRow.id);
    const primaryTagRows = await fetchTagsForCorpusIds([primaryId]);
    const primaryTagIds = primaryTagRows.map((tag) => toNumber(tag.tag_id));
    const secondaryCategoryId = primaryRow.secondary_category_id
      ? toNumber(primaryRow.secondary_category_id)
      : null;

    const similarIds = await fetchSimilarIds({
      primaryId,
      primaryTagIds,
      secondaryCategoryId,
      offset: similarOffset,
    });

    const recommendedIds = await fetchRecommendedIds({
      primaryId,
      excludeIds: similarIds,
      primaryTagIds,
      primaryCategoryName: primaryRow.category,
      offset: recommendedOffset,
    });

    const secondaryRows = await fetchRowsByIds([...similarIds, ...recommendedIds]);
    const rowById = new Map<number, CorpusSearchRow>(
      [primaryRow, ...secondaryRows].map((row) => [toNumber(row.id), row]),
    );

    const corpusIds = Array.from(rowById.keys());
    const uniqueIds = Array.from(rowById.values()).map((row) => row.unique_id);

    const [allTagRows, recommendedTagRows, contributorRows] = await Promise.all([
      fetchTagsForCorpusIds(corpusIds),
      fetchRecommendedTagsForCorpusIds(corpusIds),
      fetchContributors(uniqueIds),
    ]);

    const relatedTagsByCorpus = groupTagsByCorpus(allTagRows);
    const recommendedTagsByCorpus = groupTagsByCorpus(recommendedTagRows);
    const contributorsByUniqueId = groupContributorsByUniqueId(contributorRows);

    const build = (row: CorpusSearchRow) =>
      buildEntryIdentity(row, {
        relatedTags: relatedTagsByCorpus.get(toNumber(row.id)),
        recommendedTags: recommendedTagsByCorpus.get(toNumber(row.id)),
        contributorIds: contributorsByUniqueId.get(row.unique_id),
      });

    const response: EntrySearchResponse = {
      query,
      primary: build(primaryRow),
      similar: similarIds
        .map((id) => rowById.get(id))
        .filter((row): row is CorpusSearchRow => Boolean(row))
        .map(build),
      recommended: recommendedIds
        .map((id) => rowById.get(id))
        .filter((row): row is CorpusSearchRow => Boolean(row))
        .map(build),
      cursors: {
        similarNext:
          similarIds.length === SIMILAR_LIMIT
            ? String(similarOffset + SIMILAR_LIMIT)
            : null,
        recommendedNext:
          recommendedIds.length === RECOMMENDED_LIMIT
            ? String(recommendedOffset + RECOMMENDED_LIMIT)
            : null,
      },
    };

    return NextResponse.json(response);
  });
}
