"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MessageResponse } from "@/components/ai-elements/message";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Link } from "@/i18n/navigation";
import type { HydratedBlock } from "@/lib/assistant/blocks";
import { primaryJyutping } from "@/lib/search/entry-display";
import { AudioButton, EntryRow, WordCard } from "./entry-card";
import { QuizBlock } from "./quiz-block";

export type BlockActions = {
  /** 用户点击追问建议，作为普通消息发送 */
  onSend?: (text: string) => void;
  /** 组件内操作（答题结果等），作为 action 消息发送 */
  onAction?: (label: string) => void;
  disabled?: boolean;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

function BlockView({ block, actions }: { block: HydratedBlock; actions: BlockActions }) {
  const t = useTranslations("Assistant");

  switch (block.type) {
    case "text":
      return <MessageResponse className="text-[15px] leading-7">{block.markdown}</MessageResponse>;

    case "word_card":
      return <WordCard entry={block.entry} />;

    case "example_list":
      return (
        <div>
          <SectionLabel>{block.title || t("examples")}</SectionLabel>
          <div className="rounded-2xl bg-muted/40 p-1">
            {block.entries.map((entry) => (
              <EntryRow key={entry.corpusId} entry={entry} />
            ))}
          </div>
        </div>
      );

    case "compare_table":
      return (
        <div>
          <SectionLabel>
            {block.title}
            <span className="ml-2 font-normal opacity-70">· {t("aiGenerated")}</span>
          </SectionLabel>
          <div className="overflow-x-auto rounded-2xl bg-muted/40 p-1">
            <table className="w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-1.5 font-normal" />
                  {block.columns.map((column, index) => (
                    <th key={index} className="px-3 py-1.5 font-normal whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => {
                  // 首列已是同一字词时不再重复显示行标题
                  const first = row.cells[0];
                  const hideLabel = first?.kind === "entry" && first.entry.entryName.replace(/[。.!！?？]$/, "") === row.label;
                  return (
                    <tr key={rowIndex} className="bg-background align-top">
                      <th className="rounded-l-xl px-3 py-2.5 text-left font-medium whitespace-nowrap">
                        {hideLabel ? "" : row.label}
                      </th>
                      {row.cells.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-3 py-2.5 leading-6 last:rounded-r-xl"
                        >
                          {cell.kind === "text" ? (
                            <span className="text-muted-foreground">{cell.text}</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {cell.entry.assets.audioUrl && (
                                <AudioButton url={cell.entry.assets.audioUrl} className="size-7" />
                              )}
                              <span>
                                <span className="block font-medium">{cell.entry.entryName}</span>
                                {primaryJyutping(cell.entry) && (
                                  <span className="block font-mono text-xs text-primary/80">
                                    {primaryJyutping(cell.entry)}
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "quiz":
      return (
        <QuizBlock
          questions={block.questions}
          onAction={actions.onAction}
          disabled={actions.disabled}
        />
      );

    case "corpus_results":
      return (
        <div>
          <SectionLabel>{t("relatedCorpus")}</SectionLabel>
          <div className="rounded-2xl bg-muted/40 p-1">
            {block.entries.map((entry) => (
              <EntryRow key={entry.corpusId} entry={entry} />
            ))}
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(block.query)}&mode=entry${block.mediaType ? `&mediaType=${block.mediaType}` : ""}`}
            className="mt-2 inline-flex items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("moreResults", { query: block.query })}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      );

    case "suggestions":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item) => (
            <Suggestion
              key={item}
              suggestion={item}
              disabled={actions.disabled || !actions.onSend}
              onClick={(value) => actions.onSend?.(value)}
              className="h-auto rounded-full border-0 bg-muted/60 px-3.5 py-1.5 font-normal whitespace-normal text-muted-foreground hover:text-foreground"
            />
          ))}
        </div>
      );
  }
}

export function BlockList({ blocks, actions }: { blocks: HydratedBlock[]; actions: BlockActions }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} actions={actions} />
      ))}
    </div>
  );
}
