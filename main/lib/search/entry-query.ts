import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildEntryIdentity,
  type CorpusSearchRow,
  type CorpusTagRow,
  type EntryIdentity,
} from "@/lib/search/entry-identity";

type EntryIdentityRow = CorpusSearchRow & {
  related_tags: CorpusTagRow[] | null;
  recommended_tags: CorpusTagRow[] | null;
  contributor_ids: string[] | null;
};

function normalizeTags(value: CorpusTagRow[] | null): CorpusTagRow[] {
  return Array.isArray(value) ? value : [];
}

function buildFromRow(row: EntryIdentityRow): EntryIdentity {
  return buildEntryIdentity(row, {
    relatedTags: normalizeTags(row.related_tags),
    recommendedTags: normalizeTags(row.recommended_tags),
    contributorIds: row.contributor_ids ?? [],
  });
}

export async function fetchEntryIdentitiesByUniqueIds(
  uniqueIds: string[],
): Promise<EntryIdentity[]> {
  const ids = Array.from(
    new Set(uniqueIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (!ids.length) return [];

  const rows = await prisma.$queryRaw<EntryIdentityRow[]>(
    Prisma.sql`
      select
        id,
        unique_id::text as unique_id,
        data,
        note,
        structured_note,
        category,
        category_display_name,
        lifecycle_stage,
        liked_num,
        bookmark_num,
        view_num,
        created_at,
        updated_at,
        primary_category_id,
        primary_category_slug,
        primary_category_name,
        secondary_category_id,
        secondary_category_slug,
        secondary_category_name,
        related_tags,
        recommended_tags,
        contributor_ids
      from public.get_entry_identities(array[${Prisma.join(ids)}]::uuid[])
    `,
  );

  const order = new Map(ids.map((id, index) => [id, index]));
  return rows
    .sort(
      (a, b) =>
        (order.get(a.unique_id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.unique_id) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(buildFromRow);
}

export async function fetchEntryIdentityByUniqueId(
  uniqueId: string,
): Promise<EntryIdentity | null> {
  const entries = await fetchEntryIdentitiesByUniqueIds([uniqueId]);
  return entries[0] ?? null;
}
