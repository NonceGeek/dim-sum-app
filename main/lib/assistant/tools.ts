import { tool } from "ai";
import { z } from "zod";
import type { EntryIdentity } from "@/lib/search/entry-identity";
import {
  groundBlocks,
  showBlocksInputSchema,
  type Block,
  type Grounding,
} from "./blocks";
import {
  findClozeQuestions,
  listClozeScenes,
  searchCorpus,
} from "./corpus";
import { hydrateBlocks } from "./hydrate";

// 检索结果直接带较完整的释义，不再单独提供查详情工具，省去一次模型往返
const MEANING_PREVIEW_LENGTH = 300;

// 给模型看的精简语料信息；完整数据只在组件里展示
function summarizeEntry(entry: EntryIdentity) {
  return {
    corpusId: entry.corpusId,
    text: entry.entryName,
    jyutping: entry.jyutping,
    meaning: entry.meaning?.slice(0, MEANING_PREVIEW_LENGTH) ?? null,
    tags: entry.tags.precise.map((tag) => tag.name).slice(0, 5),
    mediaTypes: entry.mediaTypes,
    dataset: entry.source.categoryDisplayName ?? entry.source.categoryName,
  };
}

export type ToolTraceItem = {
  tool: string;
  input: unknown;
  resultCount: number;
  error?: string;
};

const TOOL_ERROR_MESSAGE = "语料库暂时没有响应，请如实告诉用户稍后再试，不要自行编造内容。";

/**
 * 每轮对话创建一组工具。grounding 由数据工具在返回结果时登记，
 * show_blocks 只接受登记过（或此前已展示过）的 id。
 */
export function createAssistantTools(grounding: Grounding, trace: ToolTraceItem[]) {
  const registerEntries = (entries: EntryIdentity[]) => {
    for (const entry of entries) grounding.corpusIds.add(entry.corpusId);
  };

  // 数据工具出错时把错误告诉模型，而不是让整轮回答失败
  const guarded = async <T,>(
    toolName: string,
    input: unknown,
    run: () => Promise<{ value: T; count: number }>,
  ): Promise<T | { error: string }> => {
    try {
      const { value, count } = await run();
      trace.push({ tool: toolName, input, resultCount: count });
      return value;
    } catch (error) {
      console.error(`Assistant tool ${toolName} failed:`, error);
      trace.push({ tool: toolName, input, resultCount: 0, error: String(error).slice(0, 200) });
      return { error: TOOL_ERROR_MESSAGE };
    }
  };

  return {
    search_corpus: tool({
      description:
        "在粤语语料库中检索字词、短语、俚语、例句或多媒体语料。返回语料 corpusId 与简要信息。",
      inputSchema: z.object({
        query: z.string().min(1).max(50).describe("检索词，简体或繁体均可"),
        mediaType: z
          .enum(["text", "audio", "video", "image", "model3d"])
          .optional()
          .describe("只在用户明确要某类媒体时填写"),
      }),
      execute: ({ query, mediaType }) =>
        guarded("search_corpus", { query, mediaType }, async () => {
          const entries = await searchCorpus({ query, mediaType, limit: 10 });
          registerEntries(entries);
          return { value: { results: entries.map(summarizeEntry) }, count: entries.length };
        }),
    }),


    find_cloze_questions: tool({
      description:
        "从题库中找粤语填空练习题，用于“考考我”、巩固练习。可按关键词或场景查找。",
      inputSchema: z.object({
        keyword: z.string().max(20).optional().describe("题干或选项中包含的字词"),
        scene: z.string().max(30).optional().describe("场景代码，可先调用 list_quiz_scenes"),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: ({ keyword, scene, limit }) =>
        guarded("find_cloze_questions", { keyword, scene, limit }, async () => {
          let questions = await findClozeQuestions({ keyword, scene, limit });
          if (!questions.length && keyword) {
            questions = await findClozeQuestions({ scene, limit });
          }
          for (const q of questions) grounding.questionIds.add(q.questionId);
          return {
            value: {
              questions: questions.map((q) => ({
                questionId: q.questionId,
                scene: q.scene,
                stem: `${q.stemPre}____${q.stemPost}`,
              })),
            },
            count: questions.length,
          };
        }),
    }),

    list_quiz_scenes: tool({
      description: "列出练习题的场景代码与名称。",
      inputSchema: z.object({}),
      execute: () =>
        guarded("list_quiz_scenes", {}, async () => {
          const scenes = await listClozeScenes();
          return { value: { scenes }, count: scenes.length };
        }),
    }),

    show_blocks: tool({
      description:
        "向用户展示交互组件。组件里的 corpusId / questionId 必须来自本轮工具结果或此前已展示的组件。每轮回答最多调用一次。",
      inputSchema: showBlocksInputSchema,
      execute: async ({ blocks }) => {
        const grounded = groundBlocks(blocks as Block[], grounding);
        const hydrated = await hydrateBlocks(grounded.blocks);
        trace.push({ tool: "show_blocks", input: { count: blocks.length }, resultCount: hydrated.length });
        return {
          blocks: hydrated,
          declared: grounded.blocks,
          dropped: grounded.dropped,
          strippedJyutping: grounded.strippedJyutping,
        };
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value:
          `已展示 ${output.blocks.length} 个组件` +
          (output.dropped ? `；${output.dropped} 个组件因 id 未经检索或无内容被丢弃` : ""),
      }),
    }),
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
