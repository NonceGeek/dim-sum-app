export const CORPUS_COLLECTION_CATEGORY_TYPES = ["submission_type", "tag"] as const;

export type CorpusCollectionCategoryType = (typeof CORPUS_COLLECTION_CATEGORY_TYPES)[number];

export function isCorpusCollectionCategoryType(value: unknown): value is CorpusCollectionCategoryType {
  return CORPUS_COLLECTION_CATEGORY_TYPES.includes(value as CorpusCollectionCategoryType);
}

export function serializeCorpusCollectionCategory(category: {
  id: bigint;
  name: string;
  type: string;
  status: string;
  sort_order: number;
}) {
  return {
    id: category.id.toString(),
    name: category.name,
    type: category.type,
    status: category.status,
    sortOrder: category.sort_order,
  };
}

export function getNextCategorySortOrder(currentMaximum: number | null | undefined) {
  return (currentMaximum ?? -1) + 1;
}

export function parseCategoryOrder(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("orderedIds must be a non-empty array");
  }

  const ids = value.map((item) => {
    if (typeof item !== "string" || !/^[1-9]\d*$/.test(item)) {
      throw new Error("orderedIds contains an invalid category id");
    }
    return BigInt(item);
  });

  if (new Set(ids.map(String)).size !== ids.length) {
    throw new Error("orderedIds contains duplicate category ids");
  }
  return ids;
}
