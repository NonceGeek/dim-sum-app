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
        entry.*,
        entry.unique_id::text as unique_id,
        dataset.content_attribute,
        corpus.media_types
      from public.get_entry_identities(array[${Prisma.join(ids)}]::uuid[]) entry
      join public.cantonese_corpus_all corpus on corpus.unique_id = entry.unique_id
      join public.cantonese_categories dataset on dataset.name = corpus.category
      where dataset.is_public = true
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
