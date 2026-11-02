export type SearchRow = {
  id: bigint;
  unique_id: string;
  expression: string;
  meaning: string;
  note: unknown;
  structured_note: unknown;
  dataset_name: string;
  dataset_label: string | null;
  licenses?: string[];
  rank?: number;
};
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const text = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const clean = (v: string) => v.replace(/__\d{6}_[0-9a-f]{8}$/i, "").trim();
export function httpsAudio(value: unknown): string | null {
  const v = text(value);
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? v : null;
  } catch {
    return null;
  }
}
export function jyutping(value: unknown): string | null {
  const v = text(value);
  return v && /^[a-z]+[1-6](?:[ /,;·-]+[a-z]+[1-6])*$/i.test(v) ? v : null;
}
const isYue = (v: unknown) =>
  typeof v === "string" &&
  ["yue", "zh-yue", "cantonese", "粤语", "廣東話", "广东话"].includes(
    v.toLowerCase(),
  );
const blocks = (item: Obj) =>
  Array.isArray(item.blocks) ? item.blocks.map(object) : [];
const blockText = (item: Obj, type: string) =>
  blocks(item)
    .filter((b) => b.type === type)
    .map((b) => text(b.content))
    .find(Boolean) ?? null;
function itemAudio(item: Obj) {
  const pronunciation = jyutping(item.jyutping);
  const b = blocks(item).find(
    (b) =>
      b.type === "audio" &&
      (isYue(b.language ?? b.lang) ||
        (!(b.language ?? b.lang) &&
          ((item.language ?? item.lang)
            ? isYue(item.language ?? item.lang)
            : pronunciation))) &&
      httpsAudio(b.url ?? b.link),
  );
  return b ? httpsAudio(b.url ?? b.link) : null;
}
function examples(item: Obj) {
  return blocks(item)
    .filter((b) => b.type === "example")
    .flatMap((b) => {
      const list = Array.isArray(b.content) ? b.content : [b.content];
      return list.flatMap((v) => {
        const e = object(v);
        const t = text(typeof v === "string" ? v : (e.text ?? e.sentence));
        if (!t) return [];
        return [
          {
            text: t,
            translation: text(e.translation),
            jyutping: jyutping(e.jyutping),
            audio: isYue(e.language ?? e.lang) ? httpsAudio(e.audioUrl) : null,
          },
        ];
      });
    })
    .slice(0, 3);
}
export function formatEntry(row: SearchRow) {
  const structured = object(row.structured_note);
  const items = Array.isArray(structured.data)
    ? structured.data.map(object)
    : [];
  const relevant = items.filter((i) => {
    const sentence = blockText(i, "sentence");
    return !sentence || clean(sentence) === row.expression;
  });
  let senses = relevant.flatMap((i) => {
    const meaning = blockText(i, "definition");
    return meaning
      ? [
          {
            meaning,
            jyutping: jyutping(i.jyutping),
            audio: itemAudio(i),
            usageNotes: blockText(i, "usage"),
            examples: examples(i),
          },
        ]
      : [];
  });
  const context = object(object(row.note).context);
  if (!senses.length) {
    const pron = jyutping(
      context.jyutping ?? context["粤拼"] ?? context["粤语拼音"],
    );
    const explicit =
      context["粤语"] ?? context["粤语音频"] ?? context.cantoneseAudio;
    const labelledAudio =
      pron && text(context["粤语原文"]) === row.expression
        ? httpsAudio(context.audio)
        : null;
    senses = [
      {
        meaning: row.meaning,
        jyutping: pron,
        audio: httpsAudio(explicit) ?? labelledAudio,
        usageNotes: null,
        examples: [],
      },
    ];
  }
  return {
    id: row.unique_id,
    expression: row.expression,
    senses,
    source: {
      datasetSlug: row.dataset_name,
      datasetName: row.dataset_label ?? row.dataset_name,
      licenses: row.licenses ?? [],
    },
    available: true as const,
  };
}
