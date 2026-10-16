"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { BookOpen, MousePointerClick, Search, Sparkles, Target } from "lucide-react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantKeys, useAssistantQuota } from "@/lib/api/assistant";
import type { HydratedBlock } from "@/lib/assistant/blocks";
import type { AssistantUIMessage } from "@/lib/assistant/conversation";
import { cn } from "@/lib/utils";
import { BlockList, type BlockActions } from "./block-renderer";

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: { query?: string };
  output?: { blocks?: HydratedBlock[] };
};

type Part = AssistantUIMessage["parts"][number];

function isToolPart(part: Part): part is Part & ToolPart {
  return part.type.startsWith("tool-");
}

function isDone(part: ToolPart) {
  return part.state === "output-available" || part.state === "output-error";
}

function messageText(message: AssistantUIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function AssistantAvatar() {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Sparkles className="size-4" />
    </div>
  );
}

/** 检索过程折叠为一行；生成中展开显示进度。 */
function ToolSteps({ parts, streaming }: { parts: ToolPart[]; streaming: boolean }) {
  const t = useTranslations("Assistant");
  if (!parts.length) return null;
  const done = parts.every(isDone);
  // 进行中用“正在…”，完成后改为过去式
  const describe = (part: ToolPart) => {
    const name = part.type.slice("tool-".length);
    const finished = isDone(part);
    if (name === "search_corpus") {
      const query = part.input?.query ?? "";
      return { icon: Search, label: finished ? t("stepSearched", { query }) : t("toolSearching", { query }) };
    }
    if (name === "find_cloze_questions") {
      return { icon: Target, label: finished ? t("stepQuiz") : t("toolQuiz") };
    }
    return { icon: BookOpen, label: finished ? t("stepEntries") : t("toolEntries") };
  };
  return (
    <ChainOfThought defaultOpen={streaming && !done} className="max-w-none">
      <ChainOfThoughtHeader>
        {done ? t("stepsDone", { count: parts.length }) : t("toolWorking")}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {parts.map((part) => {
          const { icon, label } = describe(part);
          return (
            <ChainOfThoughtStep
              key={part.toolCallId}
              icon={icon}
              label={label}
              status={isDone(part) ? "complete" : "active"}
            />
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
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
  const dataToolParts = message.parts.filter(
    (part): part is Part & ToolPart => isToolPart(part) && part.type !== "tool-show_blocks",
  );
  return (
    <Message from="assistant" className="max-w-full flex-row items-start gap-3">
      <AssistantAvatar />
      <MessageContent className="w-full flex-1 gap-4 overflow-visible pt-0.5">
        <ToolSteps parts={dataToolParts} streaming={streaming} />
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return part.text.trim() ? (
              <MessageResponse key={index} className="text-[15px] leading-7">
                {part.text}
              </MessageResponse>
            ) : null;
          }
          if (part.type !== "tool-show_blocks" || !isToolPart(part)) return null;
          if (part.state === "output-available" && part.output?.blocks) {
            return <BlockList key={part.toolCallId} blocks={part.output.blocks} actions={actions} />;
          }
          // 参数无效或生成已结束仍未完成的调用不再显示加载状态
          if (part.state === "output-error" || !streaming) return null;
          return (
            <div key={part.toolCallId} className="space-y-3" aria-label={t("toolBlocks")}>
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-16 w-2/3 rounded-xl" />
            </div>
          );
        })}
      </MessageContent>
    </Message>
  );
}

function UserMessageView({ message }: { message: AssistantUIMessage }) {
  const isAction = message.metadata?.kind === "action";
  return (
    <Message from="user">
      <MessageContent
        className={cn(
          "group-[.is-user]:rounded-2xl group-[.is-user]:px-4 group-[.is-user]:py-2.5 text-[15px] whitespace-pre-wrap",
          isAction &&
            "group-[.is-user]:border group-[.is-user]:border-dashed group-[.is-user]:bg-transparent group-[.is-user]:text-muted-foreground",
        )}
      >
        <span>
          {isAction && <MousePointerClick className="mr-1.5 inline size-3.5 align-[-2px]" />}
          {messageText(message)}
        </span>
      </MessageContent>
    </Message>
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
  const [errorText, setErrorText] = useState<string | null>(null);

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
              last?.metadata?.kind === "action" ? { kind: "action", label: text } : { kind: "text", text },
          },
        };
      },
    }),
    onError: (error) => {
      setErrorText(error.message.includes("QUOTA_EXCEEDED") ? t("quotaExceeded") : t("error"));
    },
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: assistantKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: assistantKeys.quota });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const quotaExhausted = quota ? quota.remaining <= 0 : false;

  const send = (text: string, kind: "text" | "action" = "text") => {
    const value = text.trim();
    if (!value || busy || quotaExhausted) return;
    setErrorText(null);
    if (!messages.length) onFirstMessage?.();
    void sendMessage({ text: value, metadata: kind === "action" ? { kind: "action" } : undefined });
  };

  const actions: BlockActions = {
    onSend: (text) => send(text),
    onAction: (label) => send(label, "action"),
    disabled: busy || quotaExhausted,
  };

  const composer = (
    <PromptInput
      onSubmit={({ text }) => {
        if (busy) {
          void stop();
          return;
        }
        send(text);
      }}
      className="[&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-sm"
    >
      <PromptInputBody>
        <PromptInputTextarea
          maxLength={500}
          disabled={quotaExhausted}
          placeholder={quotaExhausted ? t("quotaExceeded") : t("placeholder")}
          className="min-h-12 px-5 pt-4 text-[15px]"
        />
      </PromptInputBody>
      <PromptInputFooter className="px-3 pb-3">
        <span className="pl-2 text-xs text-muted-foreground">
          {quota ? t("quotaRemaining", { remaining: quota.remaining, limit: quota.limit }) : ""}
        </span>
        <PromptInputSubmit
          status={status}
          disabled={quotaExhausted}
          className="rounded-full"
          aria-label={busy ? t("stop") : t("send")}
        />
      </PromptInputFooter>
    </PromptInput>
  );

  if (!messages.length) {
    const examples = [t("example1"), t("example2"), t("example3")];
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-tight">
              <Image src="/logo.png" alt="" width={32} height={32} className="size-8" priority />
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          {composer}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <Suggestion
                key={example}
                suggestion={example}
                disabled={quotaExhausted}
                onClick={(value) => send(value)}
                className="rounded-full border-0 bg-muted/60 font-normal text-muted-foreground hover:text-foreground"
              />
            ))}
          </div>
          {errorText && <p className="mt-4 text-center text-sm text-destructive">{errorText}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-4 pt-8 pb-10">
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
            <Message from="assistant" className="max-w-full flex-row items-center gap-3">
              <AssistantAvatar />
              <span className="animate-pulse text-sm text-muted-foreground">{t("thinking")}</span>
            </Message>
          )}
          {errorText && <p className="text-sm text-destructive">{errorText}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {/* 输入框悬浮在底部，上方渐隐过渡，不用分割线 */}
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent" />
        {composer}
      </div>
    </div>
  );
}
