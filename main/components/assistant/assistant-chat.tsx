"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import BorderGlow from "@/components/ui/border-glow";
import SplitText from "@/components/ui/split-text";
import TextType from "@/components/ui/text-type";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  ArrowUp,
  BookOpen,
  MousePointerClick,
  Search,
  Square,
  Target,
} from "lucide-react";
import { useAiPalette } from "@/lib/assistant/ai-palette";
import {
  AiGlowFrame,
  AiShimmerText,
  AiSparkle,
  type GlowState,
} from "./ai-visuals";
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
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
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
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
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

function AssistantAvatar({ active = false }: { active?: boolean }) {
  return (
    <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60">
      <AiSparkle active={active} className="size-4" />
    </div>
  );
}

/** 发送按钮：空输入时低调；有内容时渐变填充并轻微放大；生成中为停止键，外圈渐变环旋转。 */
function SendButton({
  busy,
  ready,
  disabled,
  label,
}: {
  busy: boolean;
  ready: boolean;
  disabled?: boolean;
  label: string;
}) {
  const { linear, conic } = useAiPalette();
  const lit = busy || ready;
  return (
    <motion.button
      type="submit"
      disabled={disabled}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      animate={{ scale: ready && !busy ? 1.06 : 1 }}
      transition={{ type: "spring", bounce: 0.4, duration: 0.35 }}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        lit
          ? "text-white shadow-md"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
      style={lit ? { backgroundImage: linear } : undefined}
    >
      {busy && (
        <span
          aria-hidden
          className="ai-spin absolute -inset-[3px] rounded-full"
          style={{
            background: conic,
            animationDuration: "1.4s",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
          }}
        />
      )}
      {busy ? (
        <Square className="relative size-3 fill-current" />
      ) : (
        <ArrowUp className="relative size-4" />
      )}
    </motion.button>
  );
}

/** 检索过程折叠为一行；生成中展开显示进度。 */
function ToolSteps({
  parts,
  streaming,
}: {
  parts: ToolPart[];
  streaming: boolean;
}) {
  const t = useTranslations("Assistant");
  if (!parts.length) return null;
  const done = parts.every(isDone);
  // 进行中用“正在…”，完成后改为过去式
  const describe = (part: ToolPart) => {
    const name = part.type.slice("tool-".length);
    const finished = isDone(part);
    if (name === "search_corpus") {
      const query = part.input?.query ?? "";
      return {
        icon: Search,
        label: finished
          ? t("stepSearched", { query })
          : t("toolSearching", { query }),
      };
    }
    if (name === "find_cloze_questions") {
      return { icon: Target, label: finished ? t("stepQuiz") : t("toolQuiz") };
    }
    return {
      icon: BookOpen,
      label: finished ? t("stepEntries") : t("toolEntries"),
    };
  };
  return (
    <ChainOfThought defaultOpen={streaming && !done} className="max-w-none">
      <ChainOfThoughtHeader>
        {done ? (
          t("stepsDone", { count: parts.length })
        ) : (
          <AiShimmerText>{t("toolWorking")}</AiShimmerText>
        )}
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
    (part): part is Part & ToolPart =>
      isToolPart(part) && part.type !== "tool-show_blocks",
  );
  return (
    <Message from="assistant" className="max-w-full flex-row items-start gap-3">
      <AssistantAvatar active={streaming} />
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
          if (part.type !== "tool-show_blocks" || !isToolPart(part))
            return null;
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
            <div
              key={part.toolCallId}
              className="space-y-3"
              aria-label={t("toolBlocks")}
            >
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
          {isAction && (
            <MousePointerClick className="mr-1.5 inline size-3.5 align-[-2px]" />
          )}
          {messageText(message)}
        </span>
      </MessageContent>
    </Message>
  );
}

const COMPOSER_TRANSITION = {
  type: "spring",
  bounce: 0.12,
  duration: 0.55,
} as const;

export function AssistantChat({
  conversationId,
  initialMessages,
  initialQuery,
  onFirstMessage,
}: {
  conversationId: string;
  initialMessages: AssistantUIMessage[];
  initialQuery?: string;
  onFirstMessage?: () => void;
}) {
  const t = useTranslations("Assistant");
  const queryClient = useQueryClient();
  const { data: quota } = useAssistantQuota();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hasText, setHasText] = useState(false);
  const palette = useAiPalette();
  const [focused, setFocused] = useState(false);

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

  const send = (text: string, kind: "text" | "action" = "text") => {
    const value = text.trim();
    if (!value || busy || quotaExhausted) return;
    setErrorText(null);
    setHasText(false);
    if (!messages.length) onFirstMessage?.();
    void sendMessage({
      text: value,
      metadata: kind === "action" ? { kind: "action" } : undefined,
    });
  };

  // 首页带来的问题只发送一次（开发模式下 effect 会执行两次）
  const sentInitialQuery = useRef(false);
  useEffect(() => {
    if (!initialQuery || sentInitialQuery.current || messages.length) return;
    sentInitialQuery.current = true;
    send(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // 历史消息直接显示，只有新消息带入场动画
  const historyIds = useRef(
    new Set(initialMessages.map((message) => message.id)),
  );
  const enter = (id: string) =>
    historyIds.current.has(id)
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3 },
        };

  const actions: BlockActions = {
    onSend: (text) => send(text),
    onAction: (label) => send(label, "action"),
    disabled: busy || quotaExhausted,
  };

  // 空状态与对话中共用 layoutId：首次提问时输入框从页面中间平滑移到底部
  const glowState = (placement: "hero" | "dock"): GlowState => {
    if (busy) return "active";
    if (focused) return placement === "hero" ? "focus" : "idle";
    return placement === "hero" ? "idle" : "off";
  };

  // 空状态居中与对话中底部共用 layoutId：首次提问时输入框从页面中间平滑移到底部
  const renderComposer = (placement: "hero" | "dock") => {
    const state = glowState(placement);
    return (
      <motion.div
        layoutId="assistant-composer"
        transition={COMPOSER_TRANSITION}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <AiGlowFrame state={state}>
          {/* 与首页一致：鼠标靠近边缘时光晕跟随，颜色使用 AI 配色 */}
          <BorderGlow
            borderRadius={24}
            glowRadius={30}
            glowIntensity={0.8}
            edgeSensitivity={25}
            coneSpread={30}
            fillOpacity={0.3}
            glowColor={palette.glowHsl}
            backgroundColor="var(--background)"
            colors={[...palette.colors]}
            className="w-full border-transparent"
          >
            <PromptInput
              onSubmit={({ text }) => {
                if (busy) {
                  void stop();
                  return;
                }
                send(text);
              }}
              className={cn(
                // 去掉 input-group 自带的 3px 聚焦光圈，聚焦效果只由外层细彩边表现（与首页一致）
                "[&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:ring-0!",
                // 有彩色边框时去掉原有边框，避免两层描边
                state === "off"
                  ? "[&_[data-slot=input-group]]:shadow-sm"
                  : "[&_[data-slot=input-group]]:border-transparent! [&_[data-slot=input-group]]:shadow-none",
              )}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  maxLength={500}
                  disabled={quotaExhausted}
                  placeholder={
                    quotaExhausted ? t("quotaExceeded") : t("placeholder")
                  }
                  className="min-h-12 px-5 pt-4 text-[15px]"
                  onChange={(event) =>
                    setHasText(Boolean(event.currentTarget.value.trim()))
                  }
                />
              </PromptInputBody>
              <PromptInputFooter className="px-3 pb-3">
                <span className="pl-2 text-xs text-muted-foreground">
                  {quota
                    ? t("quotaRemaining", {
                        remaining: quota.remaining,
                        limit: quota.limit,
                      })
                    : ""}
                </span>
                <SendButton
                  busy={busy}
                  ready={hasText}
                  disabled={quotaExhausted}
                  label={busy ? t("stop") : t("send")}
                />
              </PromptInputFooter>
            </PromptInput>
          </BorderGlow>
        </AiGlowFrame>
      </motion.div>
    );
  };

  if (!messages.length) {
    const examples = [t("example1"), t("example2"), t("example3")];
    return (
      // 与首页保持一致：输入框纵向位置对齐首页（logo 在标题同行，padding 补足高度差）、背景光晕、标题与副标题动效、发光输入框
      <div className="relative flex h-full flex-col items-center overflow-x-hidden overflow-y-auto px-4 pt-[calc(15svh-2.75rem)] md:pt-[calc(18vh-0.45rem)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, oklch(0.95 0.04 256 / 0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, oklch(0.20 0.03 256 / 0.18), transparent 70%)",
          }}
        />
        <div className="relative flex w-full max-w-[720px] flex-col items-center">
          <div className="flex items-center gap-3">
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="relative size-10"
                priority
              />
            </motion.div>
            <SplitText
              text={t("title")}
              tag="h1"
              className="text-2xl font-semibold text-foreground md:text-3xl"
              delay={60}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="0px"
              textAlign="center"
            />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-2 h-6 w-full text-center"
          >
            <TextType
              text={[t("typing_0"), t("typing_1"), t("typing_2")]}
              className="text-sm text-muted-foreground"
              typingSpeed={60}
              deletingSpeed={30}
              pauseDuration={2000}
              showCursor
              cursorCharacter="|"
              cursorClassName="text-muted-foreground/50"
              cursorBlinkDuration={0.6}
              loop
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 w-full"
          >
            {renderComposer("hero")}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-4 flex flex-wrap justify-center gap-2"
          >
            {examples.map((example) => (
              <Suggestion
                key={example}
                suggestion={example}
                disabled={quotaExhausted}
                onClick={(value) => send(value)}
                className="rounded-full border-0 bg-muted/60 font-normal text-muted-foreground hover:text-foreground"
              />
            ))}
          </motion.div>
          {errorText && (
            <p className="mt-4 text-center text-sm text-destructive">
              {errorText}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-4 pt-8 pb-10">
          {messages.map((message, index) => (
            <motion.div key={message.id} {...enter(message.id)}>
              {message.role === "user" ? (
                <UserMessageView message={message} />
              ) : (
                <AssistantMessageView
                  message={message}
                  actions={actions}
                  streaming={busy && index === messages.length - 1}
                />
              )}
            </motion.div>
          ))}
          {status === "submitted" && (
            <Message
              from="assistant"
              className="max-w-full flex-row items-center gap-3"
            >
              <AssistantAvatar active />
              <AiShimmerText className="text-sm">{t("thinking")}</AiShimmerText>
            </Message>
          )}
          {errorText && <p className="text-sm text-destructive">{errorText}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {/* 输入框悬浮在底部，上方渐隐过渡，不用分割线 */}
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent" />
        {renderComposer("dock")}
      </div>
    </div>
  );
}
