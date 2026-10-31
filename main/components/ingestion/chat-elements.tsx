"use client";

import { cjk } from "@streamdown/cjk";
import { getToolName, type DynamicToolUIPart, type ReasoningUIPart, type ToolUIPart, type UIMessage } from "ai";
import {
  ArrowDownIcon,
  BrainIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { memo, type ComponentProps, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/* ---------- 对话容器（贴底滚动） ---------- */

export const Conversation = ({ className, ...props }: ComponentProps<typeof StickToBottom>) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export const ConversationContent = ({ className, ...props }: ComponentProps<typeof StickToBottom.Content>) => (
  <StickToBottom.Content className={cn("flex flex-col gap-6 p-4", className)} {...props} />
);

export function ConversationScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <Button
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
      onClick={() => void scrollToBottom()}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
}

/* ---------- 消息 ---------- */

export const Message = ({
  className,
  from,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: UIMessage["role"] }) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export const MessageContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3",
      className,
    )}
    {...props}
  />
);

const streamdownPlugins = { cjk };

export const MessageResponse = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children && prev.isAnimating === next.isAnimating,
);
MessageResponse.displayName = "MessageResponse";

/* ---------- 流式占位文字 ---------- */

export const Shimmer = memo(function Shimmer({
  children,
  className,
  duration = 2,
}: {
  children: string;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.span
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${children.length * 2}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{ duration, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
    >
      {children}
    </motion.span>
  );
});

/* ---------- 思考与工具调用：连续的折叠成一行 ---------- */

export type ToolPart = ToolUIPart | DynamicToolUIPart;
export type ActivityItem = { key: string; part: ReasoningUIPart | ToolPart };

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
  "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
  "input-available": <ClockIcon className="size-4 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-4" />,
  "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
  "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
  "output-error": <XCircleIcon className="size-4 text-red-600" />,
};

// 只跟随所在 trigger 的展开状态，不受外层折叠组影响
const chevron = (
  <ChevronRightIcon className="size-3.5 shrink-0 transition-transform [[data-state=open]>&]:rotate-90" />
);

export function ActivityGroup({ items, active }: { items: ActivityItem[]; active: boolean }) {
  const t = useTranslations("IngestionTasks.chat");
  const last = items.at(-1)!.part;
  const tools = items.filter(({ part }) => part.type !== "reasoning") as Array<{ key: string; part: ToolPart }>;
  const failed = tools.filter(({ part }) => part.state === "output-error").length;
  return (
    <Collapsible className="not-prose">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        {active ? (
          <Shimmer duration={1}>
            {last.type !== "reasoning" && (last.state === "input-streaming" || last.state === "input-available")
              ? t("runningTool", { name: getToolName(last) })
              : t("thinking")}
          </Shimmer>
        ) : tools.length ? (
          <span>
            {t("toolCalls", { count: tools.length })}
            {failed ? <span className="text-destructive"> · {t("toolFailures", { count: failed })}</span> : null}
          </span>
        ) : (
          <span>{t("thought")}</span>
        )}
        {chevron}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 border-l pl-3">
        {items.map(({ key, part }) =>
          part.type === "reasoning" ? <ReasoningRow key={key} part={part} /> : <ToolRow key={key} part={part} />,
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningRow({ part }: { part: ReasoningUIPart }) {
  const t = useTranslations("IngestionTasks.chat");
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground">
        <BrainIcon className="size-4 shrink-0" />
        <span className="shrink-0">{t("thought")}</span>
        <span className="truncate text-xs">{part.text.trim().split("\n")[0]}</span>
        {chevron}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 mb-3 pl-6 text-sm text-muted-foreground">
        <Streamdown plugins={streamdownPlugins}>{part.text}</Streamdown>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolRow({ part }: { part: ToolPart }) {
  const t = useTranslations("IngestionTasks.chat");
  const output = part.state === "output-available" ? part.output : undefined;
  const errorText = part.state === "output-error" ? part.errorText : undefined;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 text-left text-sm hover:text-foreground">
        <span className="shrink-0">{statusIcons[part.state]}</span>
        <span className="shrink-0 font-medium">{getToolName(part)}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{argsSummary(part.input)}</span>
        {chevron}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 py-2 pl-6">
        <ToolBlock label={t("toolInput")} value={part.input} />
        {errorText ? (
          <ToolBlock label={t("toolError")} value={errorText} error />
        ) : output !== undefined ? (
          <ToolBlock label={t("toolOutput")} value={output} />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolBlock({ label, value, error }: { label: string; value: unknown; error?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "max-h-80 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap break-all",
          error ? "bg-destructive/10 text-destructive" : "bg-muted/50",
        )}
      >
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function argsSummary(input: unknown) {
  if (!input || typeof input !== "object") return "";
  return Object.entries(input)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ")
    .slice(0, 200);
}
