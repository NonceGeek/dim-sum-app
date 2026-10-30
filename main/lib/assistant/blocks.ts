import { z } from "zod";
import type { EntryIdentity, EntryMediaType } from "@/lib/search/entry-identity";

// 模型侧的组件声明：只给出组件类型与语料/题目 id，事实数据由服务端 hydrate 时查库填充。
const corpusId = z.number().int().positive();

const MEDIA_TYPES = ["text", "audio", "video", "image", "model3d"] as const;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    markdown: z.string().min(1).max(2000).describe("简短说明，禁止书写粤拼"),
  }),
  z.object({
    type: z.literal("word_card"),
    corpusId: corpusId.describe("必须来自本轮工具结果或之前已展示的语料"),
  }),
  z.object({
    type: z.literal("example_list"),
    title: z.string().max(40).optional(),
    corpusIds: z.array(corpusId).min(1).max(8),
  }),
  z.object({
    type: z.literal("compare_table"),
    title: z.string().min(1).max(40),
    columns: z.array(z.string().min(1).max(20)).min(1).max(4),
    rows: z
      .array(
        z.object({
          label: z.string().min(1).max(20),
          cells: z
            .array(z.union([z.string().max(120), z.object({ corpusId })]))
            .min(1)
            .max(4),
        }),
      )
      .min(1)
      .max(8),
  }),
  z.object({
    type: z.literal("quiz"),
    questionIds: z.array(z.number().int().positive()).min(1).max(5),
  }),
  z.object({
    type: z.literal("corpus_results"),
    query: z.string().min(1).max(50),
    mediaType: z.enum(MEDIA_TYPES).optional(),
  }),
  z.object({
    type: z.literal("suggestions"),
    items: z.array(z.string().min(1).max(30)).min(1).max(4),
  }),
]);

export const showBlocksInputSchema = z.object({
  blocks: z.array(blockSchema).min(1).max(8),
});

// tsconfig 未开启 strict，z.infer 会把字段推断为可选，因此显式声明类型
export type CompareCellInput = string | { corpusId: number };

export type Block =
  | { type: "text"; markdown: string }
  | { type: "word_card"; corpusId: number }
  | { type: "example_list"; title?: string; corpusIds: number[] }
  | {
      type: "compare_table";
      title: string;
      columns: string[];
      rows: { label: string; cells: CompareCellInput[] }[];
    }
  | { type: "quiz"; questionIds: number[] }
  | { type: "corpus_results"; query: string; mediaType?: EntryMediaType }
  | { type: "suggestions"; items: string[] };

export type QuizQuestion = {
  questionId: number;
  scene: string;
  stemPre: string;
  stemPost: string;
  options: { text: string; jyutping: string | null }[];
  answerIndex: number;
  explanation: string | null;
};

export type CompareCell =
  | { kind: "text"; text: string }
  | { kind: "entry"; entry: EntryIdentity };

// 前端拿到的已填充组件
export type HydratedBlock =
  | { type: "text"; markdown: string }
  | { type: "word_card"; entry: EntryIdentity }
  | { type: "example_list"; title?: string; entries: EntryIdentity[] }
  | {
      type: "compare_table";
      title: string;
      columns: string[];
      rows: { label: string; cells: CompareCell[] }[];
    }
  | { type: "quiz"; questions: QuizQuestion[] }
  | {
      type: "corpus_results";
      query: string;
      mediaType?: EntryMediaType;
      entries: EntryIdentity[];
    }
  | { type: "suggestions"; items: string[] };

export function corpusIdsOf(block: Block): number[] {
  switch (block.type) {
    case "word_card":
      return [block.corpusId];
    case "example_list":
      return block.corpusIds;
    case "compare_table":
      return block.rows.flatMap((row) =>
        row.cells.flatMap((cell) => (typeof cell === "string" ? [] : [cell.corpusId])),
      );
    default:
      return [];
  }
}

export function questionIdsOf(block: Block): number[] {
  return block.type === "quiz" ? block.questionIds : [];
}

// 粤拼音节：声母+韵母+声调 1-6，例如 faan6、tong4
// 可带“读/粤拼：”前缀和括号，一并去掉
const JYUTPING_RUN =
  /[（(]?(?:[读讀]音?|[粤粵]拼|拼音)?[：:]?\s*[（(]?\b(?:[bcdfghjklmnpstwz]{0,2}[aeiouy][a-z]{0,4}[1-6])(?:\s+[bcdfghjklmnpstwz]{0,2}[aeiouy][a-z]{0,4}[1-6])*\b[)）]?/gi;

/** 去掉粤拼但保留首尾空白，用于流式文本分段处理。 */
export function removeJyutping(text: string): { text: string; stripped: number } {
  let stripped = 0;
  const result = text.replace(JYUTPING_RUN, () => {
    stripped += 1;
    return "";
  });
  return { text: stripped ? result.replace(/[ \t]{2,}/g, " ") : text, stripped };
}

/** 去掉模型自行书写的粤拼；粤拼只允许由组件从语料库中展示。 */
export function stripJyutping(text: string): { text: string; stripped: number } {
  const result = removeJyutping(text);
  return { text: result.text.trim(), stripped: result.stripped };
}

export type Grounding = {
  corpusIds: Set<number>;
  questionIds: Set<number>;
};

/**
 * 只保留引用了已接地 id 的组件；引用未知 id 的组件整体丢弃。
 * 返回过滤后的声明与被丢弃的数量。
 */
export function groundBlocks(
  blocks: Block[],
  grounding: Grounding,
): { blocks: Block[]; dropped: number; strippedJyutping: number } {
  let dropped = 0;
  let strippedJyutping = 0;
  const kept: Block[] = [];
  for (const block of blocks) {
    const corpusOk = corpusIdsOf(block).every((id) => grounding.corpusIds.has(id));
    const questionOk = questionIdsOf(block).every((id) =>
      grounding.questionIds.has(id),
    );
    if (!corpusOk || !questionOk) {
      dropped += 1;
      continue;
    }
    if (block.type === "text") {
      const result = stripJyutping(block.markdown);
      strippedJyutping += result.stripped;
      if (!result.text) {
        dropped += 1;
        continue;
      }
      kept.push({ ...block, markdown: result.text });
      continue;
    }
    if (block.type === "compare_table") {
      const rows = block.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => {
          if (typeof cell !== "string") return cell;
          const result = stripJyutping(cell);
          strippedJyutping += result.stripped;
          return result.text || "—";
        }),
      }));
      kept.push({ ...block, rows });
      continue;
    }
    kept.push(block);
  }
  return { blocks: kept, dropped, strippedJyutping };
}
