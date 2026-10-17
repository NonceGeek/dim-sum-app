import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EntryIdentity, EntryMediaType } from "@/lib/search/entry-identity";
import { fetchEntryIdentitiesByUniqueIds } from "@/lib/search/entry-query";
import {
  getDirectQueryEmbeddingText,
  getQueryEmbeddingText,
} from "@/lib/search/query-embedding";
import {
  buildResponse,
  fetchAggregatedSearchRows,
  fetchPrimarySearchRows,
  fetchSemanticSearchRows,
  type AggregatedSearchRow,
} from "@/lib/search/entry-search";
import type { QuizQuestion } from "./blocks";

/** 按语料数字 id 取公开语料的完整身份信息；非公开或不存在的 id 不会出现在结果里。 */
export async function fetchEntriesByCorpusIds(
  corpusIds: number[],
): Promise<Map<number, EntryIdentity>> {
  const ids = Array.from(new Set(corpusIds));
  if (!ids.length) return new Map();
  const rows = await prisma.cantonese_corpus_all.findMany({
    where: { id: { in: ids.map((id) => BigInt(id)) } },
    select: { unique_id: true },
  });
  const entries = await fetchEntryIdentitiesByUniqueIds(
    rows.map((row) => row.unique_id),
  );
  return new Map(entries.map((entry) => [entry.corpusId, entry]));
}

const POOL_RETRY_DELAY_MS = 400;

/** 连接池繁忙（P2028：等不到空闲连接开启事务）时稍等重试一次。 */
export async function withPoolRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2028") throw error;
    await new Promise((resolve) => setTimeout(resolve, POOL_RETRY_DELAY_MS));
    return run();
  }
}

// 精确命中偶尔很慢（个别词会跑满 5 秒语句超时），超过这个时间就不等它
const PRIMARY_DEADLINE_MS = 2_500;
// 语义检索每页 3 条，小助手取两页作为例句候选
const SIMILAR_PAGES = [0, 3];

export type SearchTiming = {
  embeddingMs?: number;
  primaryMs?: number;
  semanticMs?: number;
  fallbackMs?: number;
  primaryTimedOut?: boolean;
};

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`deadline ${ms}ms exceeded`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 与公开搜索同源的检索：精确命中 + 语义相似（只取“相似”部分，不算“推荐”）。
 * 两路并行（每次最多占 2 个数据库连接，工具调用已串行，不会超过连接池）；
 * 精确命中超过 2.5 秒就放弃；语义检索失败时退回关键词聚合检索。
 */
export async function searchCorpus(params: {
  query: string;
  mediaType?: EntryMediaType;
  limit: number;
  timing?: SearchTiming;
}): Promise<EntryIdentity[]> {
  const { query, limit } = params;
  const mediaType = params.mediaType ?? null;
  const timing = params.timing ?? {};
  const since = (start: number) => Date.now() - start;

  const primaryTask = async (): Promise<AggregatedSearchRow[]> => {
    if (mediaType) return [];
    const start = Date.now();
    try {
      return await withDeadline(
        withPoolRetry(() => fetchPrimarySearchRows(query, null, null)),
        PRIMARY_DEADLINE_MS,
      );
    } catch (error) {
      if (String(error).includes("deadline")) timing.primaryTimedOut = true;
      console.error("Assistant primary search skipped:", error);
      return [];
    } finally {
      timing.primaryMs = since(start);
    }
  };

  const semanticTask = async (): Promise<AggregatedSearchRow[]> => {
    try {
      let start = Date.now();
      // 小助手接口部署在 sin1，可直连 DashScope；直连失败再走 iad1 中转
      const queryEmbeddingText = await getDirectQueryEmbeddingText(query).catch((error) => {
        console.error("Assistant direct embedding failed; using relay:", error);
        return getQueryEmbeddingText(query);
      });
      timing.embeddingMs = since(start);
      start = Date.now();
      const rows: AggregatedSearchRow[] = [];
      for (const similarOffset of SIMILAR_PAGES) {
        const page = await withPoolRetry(() =>
          fetchSemanticSearchRows({
            query,
            queryEmbeddingText,
            primaryCorpusId: undefined,
            similarOffset,
            recommendedOffset: 0,
            semanticPart: "similar",
            contentAttribute: null,
            mediaType,
          }),
        );
        rows.push(...page);
        if (page.length < 3) break;
      }
      timing.semanticMs = since(start);
      return rows;
    } catch (error) {
      console.error("Assistant semantic search failed; using fallback:", error);
      const start = Date.now();
      const rows = await withPoolRetry(() =>
        fetchAggregatedSearchRows({
          query,
          similarOffset: 0,
          recommendedOffset: 0,
          contentAttribute: null,
          mediaType,
        }),
      );
      timing.fallbackMs = since(start);
      return rows.filter((row) => row.section !== "primary");
    }
  };

  const [primaryRows, semanticRows] = await Promise.all([primaryTask(), semanticTask()]);
  const response = buildResponse({
    query,
    primaryRows,
    semanticRows,
    similarOffset: 0,
    recommendedOffset: 0,
  });
  const seen = new Set<number>();
  return [response.primary, ...response.similar, ...response.recommended]
    .filter((entry): entry is EntryIdentity => Boolean(entry))
    .filter((entry) => !seen.has(entry.corpusId) && seen.add(entry.corpusId))
    .slice(0, limit);
}

type ClozeRow = { id: bigint; scene: string; payload: Prisma.JsonValue };

type ClozePayload = {
  stemPre?: string;
  stemPost?: string;
  options?: { text?: string; jyutping?: string }[];
  answerIndex?: number;
  answer?: string;
  explanation?: string;
};

function toQuizQuestion(row: ClozeRow): QuizQuestion | null {
  const payload = (row.payload ?? {}) as ClozePayload;
  const options = (payload.options ?? [])
    .filter((option) => typeof option.text === "string" && option.text)
    .map((option) => ({ text: option.text!, jyutping: option.jyutping ?? null }));
  const answerIndex =
    typeof payload.answerIndex === "number"
      ? payload.answerIndex
      : options.findIndex((option) => option.text === payload.answer);
  if (options.length < 2 || answerIndex < 0 || answerIndex >= options.length) {
    return null;
  }
  return {
    questionId: Number(row.id),
    scene: row.scene,
    stemPre: payload.stemPre ?? "",
    stemPost: payload.stemPost ?? "",
    options,
    answerIndex,
    explanation: payload.explanation ?? null,
  };
}

/** 按关键词（题干或选项）或场景找填空题；关键词无结果时退回同场景/随机题。 */
export async function findClozeQuestions(params: {
  keyword?: string;
  scene?: string;
  limit: number;
}): Promise<QuizQuestion[]> {
  const keyword = params.keyword?.trim();
  const scene = params.scene?.trim();
  const rows = await prisma.$queryRaw<ClozeRow[]>(Prisma.sql`
    select id, scene, payload from public.game_cloze_questions
    where status = 'active'
      ${scene ? Prisma.sql`and scene = ${scene}` : Prisma.empty}
      ${keyword ? Prisma.sql`and payload::text like ${`%${keyword.replace(/[\\%_]/g, "\\$&")}%`}` : Prisma.empty}
    order by random()
    limit ${params.limit}
  `);
  return rows.map(toQuizQuestion).filter((q): q is QuizQuestion => Boolean(q));
}

export async function fetchClozeQuestionsByIds(
  ids: number[],
): Promise<Map<number, QuizQuestion>> {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return new Map();
  const rows = await prisma.$queryRaw<ClozeRow[]>(Prisma.sql`
    select id, scene, payload from public.game_cloze_questions
    where status = 'active' and id in (${Prisma.join(unique.map((id) => BigInt(id)))})
  `);
  return new Map(
    rows
      .map(toQuizQuestion)
      .filter((q): q is QuizQuestion => Boolean(q))
      .map((q) => [q.questionId, q]),
  );
}

export async function listClozeScenes(): Promise<{ code: string; name: string }[]> {
  return prisma.$queryRaw<{ code: string; name: string }[]>(Prisma.sql`
    select code, name from public.game_scenes order by code
  `);
}
