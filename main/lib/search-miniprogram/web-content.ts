import type { EntryIdentity, EntrySearchResponse } from "@/lib/search/entry-identity";
import { httpsAudio } from "./content";
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const first = (record: Record<string, unknown>, keys: string[]) => keys.map(k => text(record[k])).find(Boolean) ?? null;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const example = (value: unknown) => {
  const e = obj(value); const sentence = text(typeof value === "string" ? value : e.text ?? e.sentence);
  return sentence ? [{ text: sentence, translation: text(e.translation), jyutping: text(e.jyutping), audioUrl: httpsAudio(e.audioUrl) }] : [];
};
/** Explicit DTO: no raw notes, contributor identities or editing permissions. */
export function toPublicEntry(entry: EntryIdentity) {
  const context = obj(obj(entry.raw.note).context);
  const sections = list(obj(entry.raw.structuredNote).data).map(value => {
    const item = obj(value);
    const blocks = list(item.blocks).flatMap(value => {
      const block = obj(value); const type = text(block.type);
      if (["sentence", "phrase", "definition", "introduction", "usage", "subtitle", "transcript", "transcription", "other"].includes(type ?? "")) {
        const content = text(block.content);
        return content ? [{ type: type!, text: content, url: null as string | null, examples: [] as ReturnType<typeof example> }] : [];
      }
      if (type === "example") return [{ type, text: null, url: null, examples: (Array.isArray(block.content) ? block.content : [block.content]).flatMap(example) }];
      if (["audio", "video", "image", "model3d", "voxel"].includes(type ?? "")) {
        const url = httpsAudio(block.url ?? block.link);
        return url ? [{ type: type!, text: null, url, examples: [] }] : [];
      }
      return [];
    });
    return { jyutping: text(item.jyutping), blocks };
  }).filter(s => s.blocks.length || s.jyutping);
  const songName = first(context, ["song_name", "歌名"]);
  return {
    entryId: entry.entryId, corpusId: entry.corpusId, entryName: entry.entryName,
    contentAttribute: entry.contentAttribute, mediaTypes: entry.mediaTypes,
    jyutping: entry.jyutping, meaning: entry.meaning,
    source: { categoryName: entry.source.categoryName, categoryDisplayName: entry.source.categoryDisplayName },
    category: entry.category, tags: entry.tags,
    assets: { audioUrl: httpsAudio(entry.assets.audioUrl), videoUrl: httpsAudio(entry.assets.videoUrl),
      videoTranscript: entry.assets.videoTranscript, coverImage: httpsAudio(entry.assets.coverImage), model3dUrl: httpsAudio(entry.assets.model3dUrl) },
    content: {
      introduction: first(context, ["introduction", "简介", "介绍"]),
      description: first(context, ["描述", "description"]),
      usageNotes: first(context, ["usage", "usageNotes", "用法"]),
      song: songName ? { name: songName, album: text(context.album), artist: text(context.author), composer: text(context.composer), lyricist: text(context.lyricist), jyutping: text(context.song_name_pin) } : null,
      lyrics: list(context.lyric).flatMap(value => {
        const line = obj(value); const valueText = text(line.data ?? line.text);
        return valueText ? [{ text: valueText, jyutping: text(line.pron ?? line.jyutping), durationSeconds: typeof line.sec === "number" && Number.isFinite(line.sec) && line.sec >= 0 ? line.sec : null }] : [];
      }),
      sections,
    },
    stats: entry.stats, share: entry.share, createdAt: entry.createdAt, updatedAt: entry.updatedAt,
    available: true as const,
  };
}
export function toPublicSearch(response: EntrySearchResponse, requestId: string) {
  return { schemaVersion: 2 as const, query: response.query, requestId,
    primary: response.primary ? toPublicEntry(response.primary) : null,
    similar: response.similar.map(toPublicEntry), recommended: response.recommended.map(toPublicEntry),
    sectionStatus: response.sectionStatus, loadingSections: response.loadingSections, cursors: response.cursors };
}
