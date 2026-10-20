"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { Loader2Icon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentClient } from "./agent-client";
import { ApprovalCard } from "./approval-card";
import {
  ActivityGroup,
  type ActivityItem,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  Shimmer,
  type ToolPart,
} from "./chat-elements";
import { type AnswerPayload, QuestionCard } from "./question-card";
import { SubtaskCard } from "./subtask-card";
import type { QuestionRequest, RunTarget, RunView } from "./types";
import { useRunEvents } from "./use-run-events";

/** 给 Agent 的标准指令，与调试控制台一致；面向模型，不随界面语言切换 */
const DEFAULT_INSTRUCTION = `请先探索 input/ 中的全部文件，不要根据扩展名预设格式。识别表格结构、文本字段与音频对应关系，必要时编写临时脚本并从错误中调整。完成清洗、音频 probe/切分、ASR 和 records 校验；每个阶段写 checkpoint，最后创建合适的入库 proposal，等待人工审批。`;

type Props = {
  client: AgentClient;
  /** dim-sum-app 的任务状态；PENDING 表示还没开始对话 */
  taskStatus: string;
  closed: boolean;
  target: RunTarget;
  onRun: (run: RunView | null) => void;
};

export function AgentChat(props: Props) {
  const t = useTranslations("IngestionTasks.chat");
  const [history, setHistory] = useState<{ messages: UIMessage[]; cursor: string | null } | null>(null);
  const [error, setError] = useState("");
  const { client, onRun } = props;

  useEffect(() => {
    // 尚未开始对话的任务没有 run，也就没有历史消息
    client
      .getTask()
      .then(async ({ run }) => {
        onRun(run);
        if (!run) return setHistory({ messages: [], cursor: null });
        const page = await client.getMessages();
        setHistory({ messages: page.messages, cursor: page.next_cursor });
      })
      .catch((caught: Error) => setError(caught.message));
  }, [client, onRun]);

  if (!history)
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Shimmer className="text-sm">{t("loading")}</Shimmer>
        )}
      </div>
    );
  return <ChatInner {...props} history={history.messages} initialCursor={history.cursor} />;
}

function ChatInner({
  client,
  taskStatus,
  closed: taskClosed,
  target,
  onRun,
  history,
  initialCursor,
}: Props & { history: UIMessage[]; initialCursor: string | null }) {
  const t = useTranslations("IngestionTasks.chat");
  const [cursor, setCursor] = useState(initialCursor);
  const [input, setInput] = useState("");
  const [resumeNote, setResumeNote] = useState("");
  const resumeId = useRef<{ id: string; from?: string; note: string } | null>(null);
  const [run, setRunState] = useState<RunView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [started, setStarted] = useState(taskStatus !== "PENDING");

  const setRun = useCallback(
    (next: RunView | null) => {
      setRunState(next);
      onRun(next);
    },
    [onRun],
  );

  const refresh = useCallback(async () => {
    try {
      const view = await client.getTask();
      setRun(view.run);
      if (view.run) setStarted(true);
      setLoadError("");
    } catch (caught) {
      setLoadError((caught as Error).message);
    }
  }, [client, setRun]);

  const streamError = useRunEvents(client, started, (next) => {
    setRun(next);
    setLoadError("");
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        async prepareSendMessagesRequest({ messages, body }) {
          const resume = body?.resume as { request_id: string; note: string } | undefined;
          // 回答问题：按原 tool call 续跑，不追加 user message
          const answer = body?.questionAnswer as { id: string; answers: AnswerPayload } | undefined;
          // 执行 dim-sum-app 已做出的审批决定，带着结果自动续跑
          const executeId = body?.approvalExecute as string | undefined;
          if (resume) {
            const { url, headers } = await client.prepare("/resume");
            return { api: url, headers, body: resume };
          }
          if (answer) {
            const { url, headers } = await client.prepare(
              `/questions/${encodeURIComponent(answer.id)}/answer`,
            );
            return { api: url, headers, body: { answers: answer.answers } };
          }
          if (executeId) {
            const { url, headers } = await client.prepare(
              `/approvals/${encodeURIComponent(executeId)}/execute`,
            );
            return { api: url, headers, body: {} };
          }
          const last = [...messages].reverse().find((message) => message.role === "user");
          const text = last?.parts
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("\n")
            .trim();
          const { url, headers } = await client.prepare("/chat");
          return { api: url, headers, body: { text, request_id: last?.id } };
        },
      }),
    [client],
  );
  const chat = useChat({ id: client.taskId, transport, messages: history });
  const { sendMessage, setMessages } = chat;

  // 第一次对话创建了 run，刷新后开始订阅事件流
  useEffect(() => {
    if (!started && chat.status === "ready" && chat.messages.length) void refresh();
  }, [started, chat.status, chat.messages.length, refresh]);

  // run 有变化（其他标签页、续跑、子任务）时同步最新一页消息，保留已加载的更早消息
  useEffect(() => {
    if (run?.revision === undefined || chat.status === "streaming" || chat.status === "submitted") return;
    let cancelled = false;
    void client
      .getMessages()
      .then((page) => {
        if (cancelled) return;
        setMessages((previous) => {
          const first = (page.messages[0]?.metadata as { seq?: number })?.seq;
          const older =
            first === undefined
              ? []
              : previous.filter((message) => {
                  const seq = (message.metadata as { seq?: number })?.seq;
                  return seq !== undefined && seq < first;
                });
          return [...older, ...page.messages];
        });
      })
      .catch((caught: Error) => setLoadError(caught.message));
    return () => {
      cancelled = true;
    };
  }, [run?.revision, chat.status, client, setMessages]);

  const loadOlder = async () => {
    if (!cursor) return;
    const page = await client.getMessages(cursor);
    setMessages((current) => [...page.messages, ...current.filter((m) => !page.messages.some((p) => p.id === m.id))]);
    setCursor(page.next_cursor);
  };

  const targetId = findTarget(chat.messages, target);
  const located = useRef("");
  // 溯源目标不在已加载的消息里时，加载从目标轮次到最新的全部消息
  useEffect(() => {
    if (!target.turnId || targetId) return;
    let cancelled = false;
    void client
      .getTurnMessages(target.turnId)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.messages);
        setCursor(page.next_cursor);
      })
      .catch((caught: Error) => setLoadError(caught.message));
    return () => {
      cancelled = true;
    };
  }, [target.turnId, targetId, client, setMessages]);
  useEffect(() => {
    const key = `${target.turnId}:${target.toolCallId}`;
    if (!targetId || located.current === key) return;
    located.current = key;
    // 等对话区完成首次滚动到底部后再定位
    const timer = window.setTimeout(
      () =>
        document
          .querySelector(`[data-message-id="${CSS.escape(targetId)}"]`)
          ?.scrollIntoView({ block: "center" }),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [targetId, target.turnId, target.toolCallId]);

  const [reconciling, setReconciling] = useState(false);
  const reconcile = async (id: string) => {
    setReconciling(true);
    try {
      await client.reconcileApproval(id);
      await refresh();
    } catch (caught) {
      setLoadError((caught as Error).message);
    } finally {
      setReconciling(false);
    }
  };

  const busy = chat.status === "submitted" || chat.status === "streaming";
  // 待决定，或已决定但 Agent 还没执行
  const pendingApproval = run?.approvals.find(
    (item) =>
      item.status === "pending" || item.status === "authorized" || (item.status === "denied" && !item.settled_at),
  );
  const applyingApproval = run?.approvals.find((item) => item.status === "applying");
  const closed = taskClosed || run?.status === "cancelled" || run?.status === "completed";
  // 取消会中止进行中的流，此时的流错误不再有意义
  const error =
    loadError || (streamError ? t("eventsDisconnected") : "") || run?.last_error || (closed ? "" : chat.error?.message);
  const compaction = compactionStatus(run);
  const questions = useMemo(() => new Map((run?.questions ?? []).map((item) => [item.tool_call_id, item])), [run?.questions]);
  const answerQuestion = useCallback(
    (id: string, answers: AnswerPayload) => void sendMessage(undefined, { body: { questionAnswer: { id, answers } } }),
    [sendMessage],
  );
  const executeApproval = useCallback(
    (id: string) => void sendMessage(undefined, { body: { approvalExecute: id } }),
    [sendMessage],
  );
  const cancelQuestion = useCallback(
    async (id: string) => {
      await client.cancelQuestion(id);
      setMessages((await client.getMessages()).messages);
      await refresh();
    },
    [client, setMessages, refresh],
  );
  const canSend = !closed && !busy && (started ? run?.status === "ready" : true);
  const send = () => {
    const text = input.trim();
    if (!text || !canSend) return;
    setInput("");
    void sendMessage({ text });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          {cursor ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-center"
              onClick={() => void loadOlder().catch((e: Error) => setLoadError(e.message))}
            >
              {t("loadOlder")}
            </Button>
          ) : null}
          {chat.messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              <p>{closed ? t("emptyClosed") : t("empty")}</p>
              {!closed ? (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setInput(DEFAULT_INSTRUCTION)}>
                  {t("standardFlow")}
                </Button>
              ) : null}
            </div>
          ) : (
            chat.messages.map((message, index) => (
              <Message
                from={message.role}
                key={message.id}
                data-message-id={message.id}
                className={cn(
                  message.id === targetId && "rounded-xl ring-2 ring-amber-500/60 ring-offset-4 ring-offset-background",
                )}
              >
                <MessageContent>
                  {(message.metadata as { status?: string })?.status === "interrupted" ? (
                    <Badge variant="secondary">{t("interrupted")}</Badge>
                  ) : null}
                  <MessageParts
                    message={message}
                    streaming={busy && index === chat.messages.length - 1}
                    questions={questions}
                    canAnswer={run?.status === "waiting_input"}
                    busy={busy}
                    onAnswer={answerQuestion}
                    onCancelQuestion={cancelQuestion}
                  />
                </MessageContent>
              </Message>
            ))
          )}
          {chat.status === "submitted" ? <Shimmer className="text-sm">{t("working")}</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-2 border-t p-3">
        {compaction ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t(`compaction.${compaction}`)}
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="line-clamp-3">{error}</AlertDescription>
          </Alert>
        ) : null}
        {closed ? (
          <Alert>
            <AlertDescription>
              {run?.status === "cancelled" || taskStatus === "CANCELLED" ? t("cancelledNotice") : t("completedNotice")}
            </AlertDescription>
          </Alert>
        ) : null}
        {applyingApproval && !busy ? (
          <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <p className="min-w-0 flex-1">
              {run?.cancel_blocker ?? t("applying")}
              <span className="block truncate text-xs text-muted-foreground">{applyingApproval.proposal.summary}</span>
            </p>
            <Button size="sm" variant="outline" disabled={reconciling} onClick={() => void reconcile(applyingApproval.id)}>
              {reconciling ? t("reconciling") : t("reconcile")}
            </Button>
          </div>
        ) : null}
        {pendingApproval && !closed ? (
          <ApprovalCard taskId={client.taskId} approval={pendingApproval} busy={busy} onExecute={executeApproval} />
        ) : null}
        {run?.can_resume && !closed ? (
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            {run.unknown_calls.map((call) => (
              <details key={call.tool_call_id}>
                <summary className="cursor-pointer">{t("unknownCall", { name: call.tool_name })}</summary>
                <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted/50 p-2 text-xs">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </details>
            ))}
            {run.unknown_calls.length ? (
              <Textarea
                aria-label={t("resumeNote")}
                placeholder={t("resumeNote")}
                rows={2}
                value={resumeNote}
                onChange={(event) => setResumeNote(event.target.value)}
              />
            ) : null}
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={busy || (!!run.unknown_calls.length && !resumeNote.trim())}
                onClick={() => {
                  // 同一中断点、同一核对结论重试时复用 request_id，Agent 据此去重
                  if (resumeId.current?.from !== run.active_turn?.id || resumeId.current?.note !== resumeNote)
                    resumeId.current = { id: crypto.randomUUID(), from: run.active_turn?.id, note: resumeNote };
                  void sendMessage(undefined, {
                    body: { resume: { request_id: resumeId.current.id, note: resumeNote } },
                  });
                }}
              >
                {t("resume")}
              </Button>
            </div>
          </div>
        ) : run?.resume_blocker && !closed ? (
          <p className="text-sm text-muted-foreground">{run.resume_blocker}</p>
        ) : null}
        {chat.status === "error" && !closed ? (
          <Button variant="outline" size="sm" onClick={() => void chat.regenerate()}>
            {t("retry")}
          </Button>
        ) : null}
        {!closed ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Textarea
              aria-label={t("inputLabel")}
              className="max-h-48 min-h-10 flex-1 resize-none"
              rows={input.includes("\n") || input.length > 60 ? 4 : 1}
              placeholder={canSend ? t("placeholder") : t("placeholderBlocked")}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button type="submit" size="icon" aria-label={t("send")} disabled={!canSend || !input.trim()}>
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function MessageParts({
  message,
  streaming,
  questions,
  canAnswer,
  busy,
  onAnswer,
  onCancelQuestion,
}: {
  message: UIMessage;
  streaming: boolean;
  questions: Map<string, QuestionRequest>;
  canAnswer: boolean;
  busy: boolean;
  onAnswer: (id: string, answers: AnswerPayload) => void;
  onCancelQuestion: (id: string) => Promise<void>;
}) {
  const nodes: ReactNode[] = [];
  let group: ActivityItem[] = [];
  const flush = () => {
    if (group.length) nodes.push(<ActivityGroup key={group[0].key} items={group} active={false} />);
    group = [];
  };
  message.parts.forEach((part, index) => {
    const key = `${message.id}-${index}`;
    if (part.type === "reasoning" || (isToolUIPart(part) && !isCardTool(part))) {
      group.push({ key, part });
      return;
    }
    const node = renderPart(key, part);
    if (!node) return;
    flush();
    nodes.push(node);
  });
  if (group.length) nodes.push(<ActivityGroup key={group[0].key} items={group} active={streaming} />);
  return nodes;

  function renderPart(key: string, part: UIMessage["parts"][number]) {
    if (part.type === "text") {
      if (!part.text.trim()) return null;
      if (message.role === "user")
        return (
          <p key={key} className="whitespace-pre-wrap">
            {part.text}
          </p>
        );
      return (
        <MessageResponse
          key={key}
          isAnimating={streaming && part.state === "streaming"}
          parseIncompleteMarkdown={part.state === "streaming"}
          controls={false}
          linkSafety={{ enabled: false }}
        >
          {part.text}
        </MessageResponse>
      );
    }
    if (!isToolUIPart(part)) return null;
    if (getToolName(part) === "delegate_tasks") return <SubtaskCard key={key} output={part.output} />;
    const request = questions.get(part.toolCallId);
    return (
      <QuestionCard
        key={key}
        input={part.input}
        output={part.state === "output-available" ? part.output : undefined}
        request={request}
        interactive={canAnswer && request?.status === "pending" && part.state === "input-available"}
        busy={busy}
        onSubmit={onAnswer}
        onCancel={onCancelQuestion}
      />
    );
  }
}

/** 优先定位到工具调用所在消息，其次是轮次的首条消息 */
function findTarget(messages: UIMessage[], target: RunTarget) {
  if (target.toolCallId) {
    const hit = messages.find((message) =>
      message.parts.some((part) => isToolUIPart(part) && part.toolCallId === target.toolCallId),
    );
    if (hit) return hit.id;
  }
  if (!target.turnId) return undefined;
  return messages.find((message) =>
    (message.metadata as { turn_ids?: string[] })?.turn_ids?.includes(target.turnId!),
  )?.id;
}

// 需要用户阅读或交互的工具调用单独成卡片，不并入折叠组
function isCardTool(part: ToolPart) {
  const name = getToolName(part);
  if (name === "ask_user_question") return part.state === "input-available" || part.state === "output-available";
  return name === "delegate_tasks" && part.state === "output-available";
}

/** 与调试控制台 context-compaction.ts 一致；返回文案 key */
function compactionStatus(run: RunView | null) {
  const status = run?.context_compaction;
  if (!status || status.turn_id !== run.active_turn?.id) return undefined;
  if (status.phase === "completed") return "completed";
  if (run.active_turn.status !== "running") return undefined;
  return ["started", "retrying", "deferred"].includes(status.phase) ? status.phase : undefined;
}
