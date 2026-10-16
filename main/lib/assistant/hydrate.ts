import type { Block, HydratedBlock } from "./blocks";
import { corpusIdsOf, questionIdsOf } from "./blocks";
import {
  fetchClozeQuestionsByIds,
  fetchEntriesByCorpusIds,
  searchCorpus,
} from "./corpus";

const CORPUS_RESULTS_LIMIT = 8;

/**
 * 把组件声明填充为前端可渲染的数据，结果与输入一一对应。查不到的语料/题目会被跳过，
 * 整个组件都查不到时对应位置为 null（例如语料已下线）。
 */
async function hydrateEach(blocks: Block[]): Promise<(HydratedBlock | null)[]> {
  const [entries, questions, searches] = await Promise.all([
    fetchEntriesByCorpusIds(blocks.flatMap(corpusIdsOf)),
    fetchClozeQuestionsByIds(blocks.flatMap(questionIdsOf)),
    Promise.all(
      blocks.map((block) =>
        block.type === "corpus_results"
          ? searchCorpus({
              query: block.query,
              mediaType: block.mediaType,
              limit: CORPUS_RESULTS_LIMIT,
            }).catch((error) => {
              console.error("Assistant corpus_results search failed:", error);
              return [];
            })
          : Promise.resolve(null),
      ),
    ),
  ]);

  const hydrated: (HydratedBlock | null)[] = blocks.map(() => null);
  blocks.forEach((block, index) => {
    switch (block.type) {
      case "text":
      case "suggestions":
        hydrated[index] = block;
        return;
      case "word_card": {
        const entry = entries.get(block.corpusId);
        if (entry) hydrated[index] = { type: "word_card", entry };
        return;
      }
      case "example_list": {
        const list = block.corpusIds.flatMap((id) => entries.get(id) ?? []);
        if (list.length) {
          hydrated[index] = { type: "example_list", title: block.title, entries: list };
        }
        return;
      }
      case "compare_table": {
        const rows = block.rows.map((row) => ({
          label: row.label,
          cells: row.cells.map((cell) => {
            if (typeof cell === "string") return { kind: "text" as const, text: cell };
            const entry = entries.get(cell.corpusId);
            return entry
              ? { kind: "entry" as const, entry }
              : { kind: "text" as const, text: "—" };
          }),
        }));
        hydrated[index] = {
          type: "compare_table",
          title: block.title,
          columns: block.columns,
          rows,
        };
        return;
      }
      case "quiz": {
        const list = block.questionIds.flatMap((id) => questions.get(id) ?? []);
        if (list.length) hydrated[index] = { type: "quiz", questions: list };
        return;
      }
      case "corpus_results": {
        const results = searches[index] ?? [];
        if (results.length) {
          hydrated[index] = {
            type: "corpus_results",
            query: block.query,
            mediaType: block.mediaType,
            entries: results,
          };
        }
        return;
      }
    }
  });
  return hydrated;
}

export async function hydrateBlocks(blocks: Block[]): Promise<HydratedBlock[]> {
  return (await hydrateEach(blocks)).filter((block): block is HydratedBlock => block !== null);
}

/** 多条消息的组件一起查库，避免加载历史时每条消息各查一遍。 */
export async function hydrateBlockGroups(groups: Block[][]): Promise<HydratedBlock[][]> {
  const results = await hydrateEach(groups.flat());
  let offset = 0;
  return groups.map((group) => {
    const slice = results.slice(offset, offset + group.length);
    offset += group.length;
    return slice.filter((block): block is HydratedBlock => block !== null);
  });
}
