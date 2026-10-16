"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowUp,
  Check,
  LoaderCircle,
  MousePointerClick,
  Sparkles,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantKeys, useAssistantQuota } from "@/lib/api/assistant";
import type { HydratedBlock } from "@/lib/assistant/blocks";
import type { AssistantUIMessage } from "@/lib/assistant/conversation";
import { cn } from "@/lib/utils";
import {
  AssistantMarkdown,
  BlockList,
  type BlockActions,
} from "./block-renderer";

const MAX_INPUT_LENGTH = 500;

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: { query?: string };
  output?: { blocks?: HydratedBlock[] };
};

function isToolPart(
  part: AssistantUIMessage["parts"][number],
): part is AssistantUIMessage["parts"][number] & ToolPart {
  return part.type.startsWith("tool-");
}

function messageText(message: AssistantUIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function ToolStatus({ part }: { part: ToolPart }) {
  const t = useTranslations("Assistant");
  const done =
    part.state === "output-available" || part.state === "output-error";
  const name = part.type.slice("tool-".length);
  const label =
    name === "search_corpus"
      ? t("toolSearching", { query: part.input?.query ?? "" })
      : name === "get_entries"
        ? t("toolEntries")
        : name === "find_cloze_questions"
          ? t("toolQuiz")
          : t("toolWorking");
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {done ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      )}
      {label}
    </div>
  );
}

function AssistantMessageView({
  message,
  actions,
  streaming,
}: {
  message: AssistantUIMessage;
  actions: BlockActions;
  streaming: boolean;
}) {
  const t = useTranslations("Assistant");
  return (
    <div className="space-y-3">
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return part.text.trim() ? (
            <AssistantMarkdown key={index}>{part.text}</AssistantMarkdown>
          ) : null;
        }
        if (!isToolPart(part)) return null;
        if (part.type === "tool-show_blocks") {
          if (part.state === "output-available" && part.output?.blocks) {
            return (
              <BlockList
                key={part.toolCallId}
                blocks={part.output.blocks}
                actions={actions}
              />
            );
          }
          // 参数无效或生成已结束仍未完成的调用不再显示加载状态
          if (part.state === "output-error" || !streaming) return null;
          return (
            <div key={part.toolCallId} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {t("toolBlocks")}
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          );
        }
        // 数据工具的进度只在生成过程中显示
        return streaming ? (
          <ToolStatus key={part.toolCallId} part={part} />
        ) : null;
      })}
    </div>
  );
}

function UserMessageView({ message }: { message: AssistantUIMessage }) {
  const isAction = message.metadata?.kind === "action";
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words",
          isAction
            ? "border border-dashed bg-muted/40 text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {isAction && (
          <MousePointerClick className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
        )}
        {messageText(message)}
      </div>
    </div>
  );
}

export function AssistantChat({
  conversationId,
  initialMessages,
  onFirstMessage,
}: {
  conversationId: string;
  initialMessages: AssistantUIMessage[];
  onFirstMessage?: () => void;
}) {
  const t = useTranslations("Assistant");
  const queryClient = useQueryClient();
  const { data: quota } = useAssistantQuota();
  const [input, setInput] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop } = useChat<AssistantUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/assistant/chat",
      // 服务端保存了历史，只发送最新一条
      prepareSendMessagesRequest: ({ id, messages }) => {
        const last = messages[messages.length - 1];
        const text = last ? messageText(last) : "";
        return {
          body: {
            id,
            message:
              last?.metadata?.kind === "action"
                ? { kind: "action", label: text }
                : { kind: "text", text },
          },
        };
      },
    }),
    onError: (error) => {
      setErrorText(
        error.message.includes("QUOTA_EXCEEDED")
          ? t("quotaExceeded")
          : t("error"),
      );
    },
    onFinish: () => {
      void queryClient.invalidateQueries({
        queryKey: assistantKeys.conversations,
      });
      void queryClient.invalidateQueries({ queryKey: assistantKeys.quota });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const quotaExhausted = quota ? quota.remaining <= 0 : false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = (text: string, kind: "text" | "action" = "text") => {
    const value = text.trim();
    if (!value || busy) return;
    setErrorText(null);
    if (!messages.length) onFirstMessage?.();
    void sendMessage({
      text: value,
      metadata: kind === "action" ? { kind: "action" } : undefined,
    });
  };

  const actions: BlockActions = {
    onSend: (text) => send(text),
    onAction: (label) => send(label, "action"),
    disabled: busy || quotaExhausted,
  };

  const examples = [t("example1"), t("example2"), t("example3")];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {!messages.length && (
            <div className="mx-auto max-w-xl pt-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <h1 className="mt-3 text-2xl font-semibold">{t("title")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("subtitle")}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={quotaExhausted}
                    onClick={() => send(example)}
                    className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) =>
            message.role === "user" ? (
              <UserMessageView key={message.id} message={message} />
            ) : (
              <AssistantMessageView
                key={message.id}
                message={message}
                actions={actions}
                streaming={busy && index === messages.length - 1}
              />
            ),
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              {t("thinking")}
            </div>
          )}
          {errorText && <p className="text-sm text-destructive">{errorText}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl border-t px-4 py-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
            setInput("");
          }}
        >
          <textarea
            value={input}
            maxLength={MAX_INPUT_LENGTH}
            rows={1}
            disabled={quotaExhausted}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send(input);
                setInput("");
              }
            }}
            placeholder={quotaExhausted ? t("quotaExceeded") : t("placeholder")}
            className="max-h-40 min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => void stop()}
              aria-label={t("stop")}
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || quotaExhausted}
              aria-label={t("send")}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </form>
        {quota && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("quotaRemaining", {
              remaining: quota.remaining,
              limit: quota.limit,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
