import type { Block, HydratedBlock } from "./blocks";
import { corpusIdsOf, questionIdsOf } from "./blocks";
import {
  fetchClozeQuestionsByIds,
  fetchEntriesByCorpusIds,
  searchCorpus,
} from "./corpus";

const CORPUS_RESULTS_LIMIT = 8;

/**
 * 把组件声明填充为前端可渲染的数据。查不到的语料/题目会被跳过，
 * 整个组件都查不到时丢弃该组件（例如语料已下线）。
 */
export async function hydrateBlocks(blocks: Block[]): Promise<HydratedBlock[]> {
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

  const hydrated: HydratedBlock[] = [];
  blocks.forEach((block, index) => {
    switch (block.type) {
      case "text":
      case "suggestions":
        hydrated.push(block);
        return;
      case "word_card": {
        const entry = entries.get(block.corpusId);
        if (entry) hydrated.push({ type: "word_card", entry });
        return;
      }
      case "example_list": {
        const list = block.corpusIds.flatMap((id) => entries.get(id) ?? []);
        if (list.length) {
          hydrated.push({ type: "example_list", title: block.title, entries: list });
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
        hydrated.push({
          type: "compare_table",
          title: block.title,
          columns: block.columns,
          rows,
        });
        return;
      }
      case "quiz": {
        const list = block.questionIds.flatMap((id) => questions.get(id) ?? []);
        if (list.length) hydrated.push({ type: "quiz", questions: list });
        return;
      }
      case "corpus_results": {
        const results = searches[index] ?? [];
        if (results.length) {
          hydrated.push({
            type: "corpus_results",
            query: block.query,
            mediaType: block.mediaType,
            entries: results,
          });
        }
        return;
      }
    }
  });
  return hydrated;
}
