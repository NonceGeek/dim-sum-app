"use client";

import ReactMarkdown from "react-markdown";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { HydratedBlock } from "@/lib/assistant/blocks";
import { primaryJyutping } from "@/lib/search/entry-display";
import { AudioButton, EntryCard } from "./entry-card";
import { QuizBlock } from "./quiz-block";

export type BlockActions = {
  /** 用户点击追问建议，作为普通消息发送 */
  onSend?: (text: string) => void;
  /** 组件内操作（答题结果等），作为 action 消息发送 */
  onAction?: (label: string) => void;
  disabled?: boolean;
};

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&_a]:underline [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

function BlockView({ block, actions }: { block: HydratedBlock; actions: BlockActions }) {
  const t = useTranslations("Assistant");

  switch (block.type) {
    case "text":
      return <AssistantMarkdown>{block.markdown}</AssistantMarkdown>;

    case "word_card":
      return <EntryCard entry={block.entry} />;

    case "example_list":
      return (
        <div className="space-y-2">
          {block.title && <div className="text-sm font-medium">{block.title}</div>}
          <div className="grid gap-2 sm:grid-cols-2">
            {block.entries.map((entry) => (
              <EntryCard key={entry.corpusId} entry={entry} compact />
            ))}
          </div>
        </div>
      );

    case "compare_table":
      return (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">{block.title}</span>
            <span className="text-xs text-muted-foreground">{t("aiGenerated")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium" />
                  {block.columns.map((column, index) => (
                    <th key={index} className="px-3 py-2 font-medium whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b last:border-0 align-top">
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{row.label}</th>
                    {row.cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2">
                        {cell.kind === "text" ? (
                          cell.text
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-medium">{cell.entry.entryName}</span>
                            {primaryJyutping(cell.entry) && (
                              <span className="text-xs text-muted-foreground">
                                {primaryJyutping(cell.entry)}
                              </span>
                            )}
                            {cell.entry.assets.audioUrl && (
                              <AudioButton url={cell.entry.assets.audioUrl} className="h-7 w-7" />
                            )}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
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
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {block.entries.map((entry) => (
              <EntryCard key={entry.corpusId} entry={entry} compact />
            ))}
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(block.query)}&mode=entry${block.mediaType ? `&mediaType=${block.mediaType}` : ""}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("moreResults", { query: block.query })}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      );

    case "suggestions":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item) => (
            <button
              key={item}
              type="button"
              disabled={actions.disabled || !actions.onSend}
              onClick={() => actions.onSend?.(item)}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
      );
  }
}

export function BlockList({ blocks, actions }: { blocks: HydratedBlock[]; actions: BlockActions }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} actions={actions} />
      ))}
    </div>
  );
}
