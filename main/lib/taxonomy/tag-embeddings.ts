import type { PrismaClient } from "@prisma/client";
import { getQueryEmbeddingText } from "../search/query-embedding";

const FACET_ZH: Record<string, string> = {
  kind: "内容体裁", media: "媒体形式", language: "语言", source: "来源作品",
  scene: "场景", topic: "主题", region: "地域", dialect: "方言", other: "未分类",
};

const SWEEP_CONCURRENCY = 3;

type TagEmbeddingSource = { id: bigint; name: string; facet: string; gloss: string | null };

export function buildTagEmbeddingInput(name: string, facet: string, gloss: string | null) {
  // facet=other means "unclassified"; including it would inflate similarity between all other-tags.
  if (facet && facet !== "other") return `「${name}」（${FACET_ZH[facet] ?? facet}）：${gloss ?? ""}`;
  return `「${name}」：${gloss ?? ""}`;
}

async function embedTagRow(db: PrismaClient, tag: TagEmbeddingSource) {
  const embedding = await getQueryEmbeddingText(buildTagEmbeddingInput(tag.name, tag.facet, tag.gloss));
  if (!embedding) throw new Error("Empty tag embedding input");
  // Guarded by IS NULL so a concurrent after() and cron sweep cannot clobber each other.
  const updated = await db.$executeRaw`
    UPDATE tags SET embedding = ${embedding}::vector WHERE id = ${tag.id} AND embedding IS NULL`;
  return updated > 0;
}

export async function embedTag(db: PrismaClient, id: bigint) {
  const [tag] = await db.$queryRaw<TagEmbeddingSource[]>`
    SELECT id, name, facet, gloss FROM tags WHERE id = ${id} AND embedding IS NULL`;
  return tag ? embedTagRow(db, tag) : false;
}

export async function embedMissingTags(db: PrismaClient, limit: number) {
  const tags = await db.$queryRaw<TagEmbeddingSource[]>`
    SELECT id, name, facet, gloss FROM tags
    WHERE embedding IS NULL AND status = 'active'
    ORDER BY id LIMIT ${limit}`;
  const failed: string[] = [];
  let embedded = 0;
  for (let index = 0; index < tags.length; index += SWEEP_CONCURRENCY) {
    const chunk = tags.slice(index, index + SWEEP_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((tag) => embedTagRow(db, tag)));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") embedded += result.value ? 1 : 0;
      else failed.push(chunk[offset].id.toString());
    });
  }
  return { scanned: tags.length, embedded, failed };
}
