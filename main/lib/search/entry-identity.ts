export type EntryTag = {
  id: number;
  slug: string;
  name: string;
  facet: string;
  role: "related" | "recommended";
  relevanceLevel: "medium";
};

export type EntryIdentity = {
  corpusId: number;
  entryId: string;
  entryName: string;
  editableLevel: number;
  jyutping: string | null;
  meaning: string | null;
  source: {
    categoryName: string;
    categoryDisplayName: string | null;
    contributorIds: string[];
  };
  category: {
    primary: EntryCategory | null;
    secondary: EntryCategory | null;
  };
  tags: {
    precise: EntryTag[];
    related: EntryTag[];
    recommended: EntryTag[];
  };
  assets: {
    audioUrl: string | null;
    videoUrl: string | null;
    coverImage: string | null;
  };
  stats: {
    likes: number;
    bookmarks: number;
    views: number;
  };
  share: {
    cardUrl: string;
    seoUrl: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type EntrySearchResponse = {
  query: string;
  primary: EntryIdentity | null;
  similar: EntryIdentity[];
  recommended: EntryIdentity[];
  loadingSections?: {
    primary: boolean;
    semantic: boolean;
  };
  sectionStatus?: {
    primary: "idle" | "loading" | "success" | "error";
    semantic: "idle" | "loading" | "success" | "error" | "fallback";
  };
  cursors: {
    similarNext: string | null;
    recommendedNext: string | null;
  };
};

export type EntryCategory = {
  id: number;
  slug: string;
  name: string;
};

export type CorpusSearchRow = {
  id: bigint | number;
  unique_id: string;
  data: string;
  note: unknown;
  structured_note: unknown;
  category: string;
  category_display_name: string | null;
  editable_level: bigint | number | null;
  lifecycle_stage: string;
  liked_num: bigint | number | null;
  bookmark_num: bigint | number | null;
  view_num: bigint | number | null;
  created_at: Date;
  updated_at: Date;
  primary_category_id: bigint | number | null;
  primary_category_slug: string | null;
  primary_category_name: string | null;
  secondary_category_id: bigint | number | null;
  secondary_category_slug: string | null;
  secondary_category_name: string | null;
};

export type CorpusTagRow = {
  corpus_id: bigint | number;
  tag_id: bigint | number;
  slug: string;
  name: string;
  facet: string;
};

export type ContributorRow = {
  corpus_id: bigint | number;
  contributor_ids: string[] | null;
};

type StructuredBlock = {
  type?: string;
  content?: unknown;
  url?: unknown;
};

type StructuredDataItem = {
  jyutping?: unknown;
  blocks?: StructuredBlock[];
};

function asNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

function asIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function getStructuredItems(structuredNote: unknown): StructuredDataItem[] {
  if (!structuredNote || typeof structuredNote !== "object") return [];
  const data = (structuredNote as { data?: unknown }).data;
  return Array.isArray(data) ? (data as StructuredDataItem[]) : [];
}

function getNoteContext(note: unknown): Record<string, unknown> | null {
  if (!note || typeof note !== "object" || Array.isArray(note)) return null;
  const context = (note as { context?: unknown }).context;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  return context as Record<string, unknown>;
}

function firstContextString(
  note: unknown,
  keys: string[],
  transform: (value: string) => string = (value) => value.trim(),
): string | null {
  const context = getNoteContext(note);
  if (!context) return null;

  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return transform(value);
    if (Array.isArray(value)) {
      const text = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map(transform)
        .filter(Boolean)
        .join("、");
      if (text) return text;
    }
  }

  return null;
}

function firstBlockValue(
  structuredNote: unknown,
  type: string,
  field: "content" | "url" = "content",
): string | null {
  for (const item of getStructuredItems(structuredNote)) {
    if (!Array.isArray(item.blocks)) continue;
    const block = item.blocks.find((candidate) => candidate?.type === type);
    const value = block?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stripImportSuffix(value: string): string {
  return value.replace(/__\d{6}_[0-9a-f]{8}$/i, "").trim();
}

function cleanEntryName(data: string, structuredNote: unknown): string {
  const sentence = firstBlockValue(structuredNote, "sentence");
  if (sentence && sentence !== data) {
    return stripImportSuffix(sentence);
  }
  return stripImportSuffix(data);
}

function cleanJyutping(value: string): string {
  return value.replace(/\s+\d{6}\s+[0-9a-f]{8}$/i, "").trim();
}

function firstJyutping(structuredNote: unknown, note: unknown): string | null {
  for (const item of getStructuredItems(structuredNote)) {
    if (typeof item.jyutping === "string" && item.jyutping.trim()) {
      return cleanJyutping(item.jyutping);
    }
  }

  return firstContextString(
    note,
    ["jyutping", "粤拼", "粤语拼音", "pron", "pinyin", "拼音"],
    cleanJyutping,
  );
}

function firstMeaning(structuredNote: unknown, note: unknown): string | null {
  const structuredMeaning = firstBlockValue(structuredNote, "definition");
  if (structuredMeaning) return structuredMeaning;

  return firstContextString(note, [
    "meaning",
    "definition",
    "translation",
    "普通话翻译",
    "中文翻译",
    "释义",
    "意思",
  ]);
}

function firstAssetUrl(
  structuredNote: unknown,
  note: unknown,
  blockType: "audio" | "video" | "image",
): string | null {
  const structuredUrl = firstBlockValue(structuredNote, blockType, "url");
  if (structuredUrl) return structuredUrl;

  const keyMap = {
    audio: ["audio", "audioUrl", "音频", "音频链接"],
    video: ["video", "videoUrl", "视频", "视频链接"],
    image: ["image", "imageUrl", "cover", "coverImage", "图片", "封面", "封面图"],
  } satisfies Record<typeof blockType, string[]>;

  return firstContextString(note, keyMap[blockType]);
}

function buildCategory(row: CorpusSearchRow) {
  const primary =
    row.primary_category_id && row.primary_category_slug && row.primary_category_name
      ? {
          id: asNumber(row.primary_category_id),
          slug: row.primary_category_slug,
          name: row.primary_category_name,
        }
      : null;

  const secondary =
    row.secondary_category_id &&
    row.secondary_category_slug &&
    row.secondary_category_name
      ? {
          id: asNumber(row.secondary_category_id),
          slug: row.secondary_category_slug,
          name: row.secondary_category_name,
        }
      : null;

  return { primary, secondary };
}

function buildRelatedTags(rows: CorpusTagRow[] | undefined): EntryTag[] {
  return (rows ?? []).map((row) => ({
    id: asNumber(row.tag_id),
    slug: row.slug,
    name: row.name,
    facet: row.facet,
    role: "related",
    relevanceLevel: "medium",
  }));
}

function buildRecommendedTags(rows: CorpusTagRow[] | undefined): EntryTag[] {
  return (rows ?? []).map((row) => ({
    id: asNumber(row.tag_id),
    slug: row.slug,
    name: row.name,
    facet: row.facet,
    role: "recommended",
    relevanceLevel: "medium",
  }));
}

export function buildEntryIdentity(
  row: CorpusSearchRow,
  options: {
    relatedTags?: CorpusTagRow[];
    recommendedTags?: CorpusTagRow[];
    contributorIds?: string[];
  } = {},
): EntryIdentity {
  const entryId = row.unique_id;

  return {
    corpusId: asNumber(row.id),
    entryId,
    entryName: cleanEntryName(row.data, row.structured_note),
    editableLevel: asNumber(row.editable_level),
    jyutping: firstJyutping(row.structured_note, row.note),
    meaning: firstMeaning(row.structured_note, row.note),
    source: {
      categoryName: row.category,
      categoryDisplayName: row.category_display_name,
      contributorIds: options.contributorIds ?? [],
    },
    category: buildCategory(row),
    tags: {
      precise: [],
      related: buildRelatedTags(options.relatedTags),
      recommended: buildRecommendedTags(options.recommendedTags),
    },
    assets: {
      audioUrl: firstAssetUrl(row.structured_note, row.note, "audio"),
      videoUrl: firstAssetUrl(row.structured_note, row.note, "video"),
      coverImage: firstAssetUrl(row.structured_note, row.note, "image"),
    },
    stats: {
      likes: asNumber(row.liked_num),
      bookmarks: asNumber(row.bookmark_num),
      views: asNumber(row.view_num),
    },
    share: {
      cardUrl: `https://card.app.aidimsum.com/?uuid=${entryId}`,
      seoUrl: `/entries/${entryId}`,
    },
    status: row.lifecycle_stage,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function groupTagsByCorpus(rows: CorpusTagRow[]): Map<number, CorpusTagRow[]> {
  const grouped = new Map<number, CorpusTagRow[]>();
  for (const row of rows) {
    const corpusId = asNumber(row.corpus_id);
    const list = grouped.get(corpusId) ?? [];
    list.push(row);
    grouped.set(corpusId, list);
  }
  return grouped;
}

export function groupContributorsByCorpusId(
  rows: ContributorRow[],
): Map<number, string[]> {
  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    grouped.set(asNumber(row.corpus_id), row.contributor_ids?.filter(Boolean) ?? []);
  }
  return grouped;
}
