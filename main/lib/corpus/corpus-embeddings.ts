import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  DASHSCOPE_EMBEDDING_ENDPOINT,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  getDashScopeApiKey,
} from "../search/query-embedding";

const TEXT_BLOCKS = ["sentence", "definition", "introduction", "phrase", "other"] as const;
const HEADWORD_CATS = new Set(["yywj2", "zyzdv2"]);
const TEXT_BATCH = 10;
const EMBEDDING_TIMEOUT_MS = 20_000;
const EMBEDDING_ATTEMPTS = 3;
const SYNC_CONCURRENCY = 3;

type TextBlock = (typeof TEXT_BLOCKS)[number];
type MediaKind = "image" | "video";
type ParsedStructuredNote = {
  texts: Record<TextBlock, string[]>;
  media: Record<MediaKind, Array<{ url: string; desc: string }>>;
};

export type CorpusEmbeddingUnit = {
  fieldType: string;
  modality: "text" | MediaKind;
  // Stored form: the script writes content_ref through oneline() into its CSV, so diffs must compare this form.
  contentRef: string;
  embedInput: string;
  mediaDesc: string | null;
};

export type StoredEmbeddingKey = { id: bigint; fieldType: string; refMd5: string };

function validUrl(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//.test(url) && !url.startsWith("hhttp");
}

export function oneline(value: string) {
  return value.replaceAll("\t", " ").replaceAll("\n", " ");
}

export function md5(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function blockContent(block: Record<string, unknown>) {
  return typeof block.content === "string" ? block.content.trim() : "";
}

export function parseStructuredNote(raw: unknown): ParsedStructuredNote | null {
  let note = raw;
  if (typeof note === "string") {
    const text = note.trim();
    if (!text || text === "null" || text === "{}") return null;
    try {
      note = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!note || typeof note !== "object") return null;
  const units = (note as { data?: unknown }).data;
  if (!Array.isArray(units) || !units.length) return null;

  const texts = Object.fromEntries(TEXT_BLOCKS.map((type) => [type, [] as string[]])) as ParsedStructuredNote["texts"];
  const media: ParsedStructuredNote["media"] = { image: [], video: [] };
  for (const unit of units) {
    const blocks: Record<string, unknown>[] = Array.isArray(unit?.blocks) ? unit.blocks : [];
    // Introduction/sentence text in the same unit describes that unit's media (image-text fusion).
    const unitDesc: string[] = [];
    for (const block of blocks) {
      const type = block?.type as TextBlock;
      if (!TEXT_BLOCKS.includes(type)) continue;
      const content = blockContent(block);
      if (!content) continue;
      texts[type].push(content);
      if (type === "introduction" || type === "sentence") unitDesc.push(content);
    }
    for (const block of blocks) {
      const type = block?.type;
      if ((type === "image" || type === "video") && validUrl(block.url)) {
        media[type].push({ url: block.url, desc: unitDesc.join(" ") });
      }
    }
  }
  const hasText = TEXT_BLOCKS.some((type) => texts[type].length);
  return hasText || media.image.length || media.video.length ? { texts, media } : null;
}

export function buildCorpusEmbeddingUnits(
  rawData: string | null,
  category: string,
  parsed: ParsedStructuredNote,
): CorpusEmbeddingUnit[] {
  const data = (rawData ?? "").trim();
  const units: Array<Omit<CorpusEmbeddingUnit, "contentRef">> = [];
  const text = (fieldType: string, embedInput: string) =>
    units.push({ fieldType, modality: "text", embedInput, mediaDesc: null });

  // data is already inside 「」, so blocks repeating it are not concatenated again.
  const blocksText = TEXT_BLOCKS.flatMap((type) => parsed.texts[type]).filter((content) => content !== data);
  const doc = [...(data ? [`「${data}」`] : []), ...blocksText].join(" ").trim();
  if (doc) text("doc", doc);
  if (data && HEADWORD_CATS.has(category)) text("headword", data);
  parsed.texts.sentence.forEach((content) => text("sentence", content));
  parsed.texts.definition.forEach((content) => text("definition", content));
  for (const kind of ["image", "video"] as const) {
    for (const { url, desc } of parsed.media[kind]) {
      units.push({ fieldType: kind, modality: kind, embedInput: url, mediaDesc: desc || null });
    }
  }

  // Same (field_type, content_ref) twice would hit the corpus_field_emb_dedup unique index.
  // Keyed on the stored form, since that is what the index sees.
  const seen = new Set<string>();
  return units.flatMap((unit) => {
    const contentRef = oneline(unit.embedInput);
    const key = `${unit.fieldType}\u0000${contentRef}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...unit, contentRef }];
  });
}

export function diffEmbeddingUnits(desired: CorpusEmbeddingUnit[], stored: StoredEmbeddingKey[]) {
  const storedKeys = new Set(stored.map((row) => `${row.fieldType}:${row.refMd5}`));
  const desiredKeys = new Set(desired.map((unit) => `${unit.fieldType}:${md5(unit.contentRef)}`));
  return {
    toInsert: desired.filter((unit) => !storedKeys.has(`${unit.fieldType}:${md5(unit.contentRef)}`)),
    toDeleteIds: stored.filter((row) => !desiredKeys.has(`${row.fieldType}:${row.refMd5}`)).map((row) => row.id),
  };
}

// ---------- DashScope ----------
type DashScopeBatchResponse = {
  output?: { embeddings?: Array<{ index?: number; embedding?: number[] }> };
  message?: string;
  code?: string;
};

async function requestEmbeddings(contents: Array<Record<string, string>>) {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) throw new Error("DashScope API key is missing");
  let lastError: unknown;
  for (let attempt = 0; attempt < EMBEDDING_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(DASHSCOPE_EMBEDDING_ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: { contents },
          parameters: { dimension: EMBEDDING_DIMENSION },
        }),
      });
      const payload = (await response.json()) as DashScopeBatchResponse;
      if (!response.ok) {
        throw new Error(payload.message || payload.code || `DashScope embedding request failed: ${response.status}`);
      }
      const embeddings = [...(payload.output?.embeddings ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return embeddings.map(({ embedding }) => {
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
          throw new Error(`DashScope embedding response missing ${EMBEDDING_DIMENSION}-d vector`);
        }
        return `[${embedding.join(",")}]`;
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 < EMBEDDING_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function embedUnits(units: CorpusEmbeddingUnit[]) {
  const vectors = new Map<CorpusEmbeddingUnit, string>();
  const textUnits = units.filter((unit) => unit.modality === "text");
  for (let index = 0; index < textUnits.length; index += TEXT_BATCH) {
    const chunk = textUnits.slice(index, index + TEXT_BATCH);
    const embeddings = await requestEmbeddings(chunk.map((unit) => ({ text: unit.embedInput })));
    if (embeddings.length !== chunk.length) {
      throw new Error(`DashScope returned ${embeddings.length} vectors, expected ${chunk.length}`);
    }
    chunk.forEach((unit, offset) => vectors.set(unit, embeddings[offset]));
  }
  for (const unit of units) {
    if (unit.modality === "text") continue;
    const contents = [{ [unit.modality]: unit.embedInput }, ...(unit.mediaDesc ? [{ text: unit.mediaDesc }] : [])];
    const [embedding] = await requestEmbeddings(contents);
    if (!embedding) throw new Error("DashScope returned no media vector");
    vectors.set(unit, embedding);
  }
  return vectors;
}

// ---------- sync ----------
type CorpusCandidate = {
  id: bigint;
  data: string;
  category: string;
  structured_note: unknown;
  updated_at: Date;
};

type CorpusSyncOutcome = "inserted" | "unchanged" | "skipped";

export type CorpusEmbeddingSyncResult = {
  scanned: number;
  processed: number;
  inserted: number;
  deleted: number;
  unchanged: number;
  skipped: number;
  deferred: number;
  failed: string[];
  embeddedTexts: number;
  embeddedMedia: number;
};

// New rows (no vectors yet) and rows edited since their vectors were last stamped.
async function findCandidates(db: PrismaClient, limit: number) {
  return db.$queryRaw<CorpusCandidate[]>`
    SELECT c.id, c.data, c.category, c.structured_note, c.updated_at
    FROM cantonese_corpus_all c
    LEFT JOIN LATERAL (
      SELECT max(e.updated_at) AS emb_at FROM corpus_field_embeddings e WHERE e.corpus_id = c.id
    ) e ON true
    WHERE (e.emb_at IS NULL AND jsonb_typeof(c.structured_note -> 'data') = 'array'
           AND jsonb_array_length(c.structured_note -> 'data') > 0)
       OR (e.emb_at IS NOT NULL AND c.updated_at > e.emb_at)
    ORDER BY c.id DESC
    LIMIT ${limit}`;
}

async function findStoredKeys(db: PrismaClient, corpusIds: bigint[]) {
  const stored = new Map<bigint, StoredEmbeddingKey[]>();
  if (!corpusIds.length) return stored;
  const rows = await db.$queryRaw<Array<{ id: bigint; corpus_id: bigint; field_type: string; ref_md5: string }>>`
    SELECT id, corpus_id, field_type, md5(content_ref) AS ref_md5
    FROM corpus_field_embeddings WHERE corpus_id IN (${Prisma.join(corpusIds)})`;
  for (const row of rows) {
    const list = stored.get(row.corpus_id) ?? [];
    list.push({ id: row.id, fieldType: row.field_type, refMd5: row.ref_md5 });
    stored.set(row.corpus_id, list);
  }
  return stored;
}

export async function syncCorpusEmbeddings(
  db: PrismaClient,
  options: { limit: number; deadlineMs: number; dryRun?: boolean },
): Promise<CorpusEmbeddingSyncResult> {
  const startedAt = Date.now();
  const candidates = await findCandidates(db, options.limit);
  const storedByCorpus = await findStoredKeys(db, candidates.map((row) => row.id));
  const result: CorpusEmbeddingSyncResult = {
    scanned: candidates.length, processed: 0, inserted: 0, deleted: 0, unchanged: 0, skipped: 0,
    deferred: 0, failed: [], embeddedTexts: 0, embeddedMedia: 0,
  };

  async function syncOne(corpus: CorpusCandidate): Promise<CorpusSyncOutcome> {
    const parsed = parseStructuredNote(corpus.structured_note);
    const desired = parsed ? buildCorpusEmbeddingUnits(corpus.data, corpus.category, parsed) : [];
    const stored = storedByCorpus.get(corpus.id) ?? [];
    if (!desired.length && !stored.length) return "skipped";

    const { toInsert, toDeleteIds } = diffEmbeddingUnits(desired, stored);
    if (options.dryRun) {
      result.inserted += toInsert.length;
      result.deleted += toDeleteIds.length;
      return toInsert.length || toDeleteIds.length ? "inserted" : "unchanged";
    }

    const vectors = await embedUnits(toInsert);
    const writes = [];
    if (toDeleteIds.length) {
      writes.push(db.$executeRaw`DELETE FROM corpus_field_embeddings WHERE id IN (${Prisma.join(toDeleteIds)})`);
    }
    if (toInsert.length) {
      // Stamped with the corpus updated_at we read, so an edit landing mid-sync still looks newer next run.
      const values = toInsert.map((unit) => Prisma.sql`(
        ${corpus.id}, ${unit.fieldType}, ${unit.modality}, ${unit.contentRef},
        ${vectors.get(unit)}::vector, ${corpus.updated_at})`);
      writes.push(db.$executeRaw`
        INSERT INTO corpus_field_embeddings (corpus_id, field_type, modality, content_ref, embedding, updated_at)
        VALUES ${Prisma.join(values)} ON CONFLICT DO NOTHING`);
    }
    writes.push(db.$executeRaw`
      UPDATE corpus_field_embeddings SET updated_at = ${corpus.updated_at} WHERE corpus_id = ${corpus.id}`);
    await db.$transaction(writes);

    result.inserted += toInsert.length;
    result.deleted += toDeleteIds.length;
    result.embeddedTexts += toInsert.filter((unit) => unit.modality === "text").length;
    result.embeddedMedia += toInsert.filter((unit) => unit.modality !== "text").length;
    return toInsert.length || toDeleteIds.length ? "inserted" : "unchanged";
  }

  for (let index = 0; index < candidates.length; index += SYNC_CONCURRENCY) {
    if (!options.dryRun && Date.now() - startedAt > options.deadlineMs) {
      result.deferred = candidates.length - index;
      break;
    }
    const chunk = candidates.slice(index, index + SYNC_CONCURRENCY);
    const outcomes = await Promise.allSettled(chunk.map(syncOne));
    outcomes.forEach((outcome, offset) => {
      if (outcome.status === "rejected") {
        result.failed.push(chunk[offset].id.toString());
        return;
      }
      if (outcome.value === "skipped") result.skipped += 1;
      else {
        result.processed += 1;
        if (outcome.value === "unchanged") result.unchanged += 1;
      }
    });
  }
  return result;
}
