import type { EntryIdentity } from "@/lib/search/entry-identity";

// 词条展示用的通用取值逻辑，搜索结果与小助手组件共用

export function displayCategory(entry: EntryIdentity): string {
  return (
    entry.category.primary?.name ||
    entry.category.secondary?.name ||
    entry.source.categoryDisplayName ||
    entry.source.categoryName
  );
}

export function entryHref(entry: EntryIdentity, returnQuery?: string): string {
  const query = returnQuery?.trim();
  if (!query) return entry.share.seoUrl;

  const params = new URLSearchParams({ fromSearch: query });
  return `${entry.share.seoUrl}?${params.toString()}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function contextText(context: Record<string, unknown> | null, keys: string[]): string | null {
  if (!context) return null;

  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .join("、");
      if (text) return text;
    }
  }

  return null;
}

export function getNoteContext(note: unknown): Record<string, unknown> | null {
  if (!isRecord(note) || !isRecord(note.context)) return null;
  return note.context;
}

export function structuredJyutping(structuredNote: unknown): string | null {
  if (!isRecord(structuredNote) || !Array.isArray(structuredNote.data)) return null;

  const values = structuredNote.data
    .filter(isRecord)
    .map((item) => item.jyutping)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  const uniqueValues = Array.from(new Set(values));

  return uniqueValues.length ? uniqueValues.join(" / ") : null;
}

export function primaryJyutping(entry: EntryIdentity): string | null {
  return (
    structuredJyutping(entry.raw.structuredNote) ||
    contextText(getNoteContext(entry.raw.note), ["pinyin", "song_name_pin"]) ||
    entry.jyutping
  );
}
