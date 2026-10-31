"use client";

import { CheckIcon, MessageCircleQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { QuestionAnswer, QuestionRequest, QuestionSpec } from "./types";

export type AnswerPayload = Record<string, { selected: string[]; other?: string }>;

type Draft = { selected: string[]; other: string; otherOn: boolean };

type ToolOutput = {
  status?: "answered" | "cancelled" | "rejected";
  answers?: Array<{ selected?: string[]; other?: string }>;
};

/** Agent 的 ask_user_question：待回答时可填写，否则展示问答结果 */
export function QuestionCard({
  input,
  output,
  request,
  interactive,
  busy,
  onSubmit,
  onCancel,
}: {
  input: unknown;
  output: unknown;
  request?: QuestionRequest;
  interactive: boolean;
  busy: boolean;
  onSubmit: (requestId: string, answers: AnswerPayload) => void;
  onCancel: (requestId: string) => Promise<void>;
}) {
  const t = useTranslations("IngestionTasks.question");
  const questions = request?.questions ?? parseQuestions(input, (n) => t("defaultHeader", { n }));
  const result = output as ToolOutput | undefined;
  const status = result?.status ?? (request?.status === "pending" ? undefined : request?.status);
  if (questions.length === 0) return null;

  return (
    <div className="not-prose w-full space-y-3 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center gap-2">
        <MessageCircleQuestionIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">{t("title")}</span>
        <Badge variant={status ? "secondary" : "default"}>{t(`status.${status ?? (request ? "pending" : "asking")}`)}</Badge>
      </div>
      {interactive && request ? (
        <QuestionForm request={request} busy={busy} onSubmit={onSubmit} onCancel={onCancel} />
      ) : (
        <QuestionSummary questions={questions} answers={answersOf(questions, request, result)} status={status} />
      )}
    </div>
  );
}

function QuestionForm({
  request,
  busy,
  onSubmit,
  onCancel,
}: {
  request: QuestionRequest;
  busy: boolean;
  onSubmit: (requestId: string, answers: AnswerPayload) => void;
  onCancel: (requestId: string) => Promise<void>;
}) {
  const t = useTranslations("IngestionTasks.question");
  const { questions } = request;
  const id = useId();
  const [active, setActive] = useState(0);
  // 草稿只保留在当前页面，刷新后从空白重新填写
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, { selected: [], other: "", otherOn: false }])),
  );
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const done = questions.filter((q) => isAnswered(q, drafts[q.id])).length;
  const complete = done === questions.length;
  const question = questions[active];
  const draft = drafts[question.id];

  const update = (patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [question.id]: { ...current[question.id], ...patch } }));

  const toggle = (label: string) => {
    if (!question.multiSelect) return update({ selected: [label], otherOn: false });
    update({
      selected: draft.selected.includes(label)
        ? draft.selected.filter((item) => item !== label)
        : [...draft.selected, label],
    });
  };

  const toggleOther = () =>
    question.multiSelect ? update({ otherOn: !draft.otherOn }) : update({ otherOn: true, selected: [] });

  const submit = () => {
    if (!complete) return;
    onSubmit(
      request.id,
      Object.fromEntries(
        questions.map((q) => {
          const item = drafts[q.id];
          const other = item.otherOn ? item.other.trim() : "";
          return [q.id, { selected: item.selected, ...(other ? { other } : {}) }];
        }),
      ),
    );
  };

  const cancel = async () => {
    setCancelling(true);
    setError("");
    try {
      await onCancel(request.id);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const onTabKey = (event: KeyboardEvent) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + questions.length) % questions.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  const inputType = question.multiSelect ? "checkbox" : "radio";
  const optionClass =
    "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50";

  return (
    <>
      {questions.length > 1 ? (
        <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1" onKeyDown={onTabKey}>
          {questions.map((q, index) => (
            <button
              key={q.id}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-controls={`${id}-panel`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
                index === active && "bg-muted text-foreground",
              )}
            >
              {isAnswered(q, drafts[q.id]) ? <CheckIcon className="size-3 text-primary" /> : null}
              {q.header}
            </button>
          ))}
          <span className="ml-auto shrink-0 self-center text-xs tabular-nums text-muted-foreground">
            {t("answeredCount", { done, total: questions.length })}
          </span>
        </div>
      ) : null}

      <fieldset id={`${id}-panel`} role={questions.length > 1 ? "tabpanel" : undefined} className="space-y-2">
        <legend className="mb-2 font-medium">
          {question.question}
          {question.multiSelect ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">{t("multiSelect")}</span>
          ) : null}
        </legend>
        {question.options.map((option) => (
          <label key={option.label} className={optionClass}>
            <input
              type={inputType}
              name={`${id}-${question.id}`}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={draft.selected.includes(option.label)}
              onChange={() => toggle(option.label)}
            />
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.description ? (
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
        <label className={cn(optionClass, "flex-wrap")}>
          <input
            type={inputType}
            name={`${id}-${question.id}`}
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={draft.otherOn}
            onChange={toggleOther}
          />
          <span className="flex-1">{t("other")}</span>
          {draft.otherOn ? (
            <Input
              aria-label={`${question.header}: ${t("other")}`}
              className="basis-full"
              placeholder={t("otherPlaceholder")}
              value={draft.other}
              autoFocus
              onChange={(event) => update({ other: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          ) : null}
        </label>
      </fieldset>

      {error ? <p className="text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {questions.length === 1 ? null : (
          <span className="mr-auto text-xs text-muted-foreground">
            {complete ? t("allAnswered") : t("answerAll")}
          </span>
        )}
        <Button variant="ghost" size="sm" disabled={busy || cancelling} onClick={cancel}>
          {cancelling ? t("cancelling") : t("cancel")}
        </Button>
        {!complete && active < questions.length - 1 && isAnswered(question, draft) ? (
          <Button variant="outline" size="sm" onClick={() => setActive(active + 1)}>
            {t("next")}
          </Button>
        ) : null}
        <Button size="sm" disabled={!complete || busy} onClick={submit}>
          {busy ? t("submitting") : t("submit")}
        </Button>
      </div>
    </>
  );
}

function QuestionSummary({
  questions,
  answers,
  status,
}: {
  questions: QuestionSpec[];
  answers: Array<QuestionAnswer | undefined>;
  status?: string;
}) {
  const t = useTranslations("IngestionTasks.question");
  return (
    <dl className="space-y-2">
      {questions.map((q, index) => {
        const answer = answers[index];
        const text = answer ? [...answer.selected, ...(answer.other ? [answer.other] : [])].join("、") : "";
        return (
          <div key={q.id}>
            <dt className="text-xs text-muted-foreground">
              {q.header} · {q.question}
            </dt>
            <dd className={cn(!text && "text-muted-foreground")}>
              {text ||
                (status === "cancelled"
                  ? t("unansweredCancelled")
                  : status === "rejected"
                    ? t("status.rejected")
                    : t("waiting"))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function isAnswered(question: QuestionSpec, draft: Draft) {
  const count = draft.selected.length + (draft.otherOn && draft.other.trim() ? 1 : 0);
  return question.multiSelect ? count > 0 : count === 1;
}

function answersOf(questions: QuestionSpec[], request: QuestionRequest | undefined, output: ToolOutput | undefined) {
  return questions.map((q, index) => {
    const stored = request?.answers?.find((item) => item.question_id === q.id);
    if (stored) return stored;
    const fromOutput = output?.answers?.[index];
    return fromOutput
      ? { question_id: q.id, selected: fromOutput.selected ?? [], other: fromOutput.other }
      : undefined;
  });
}

function parseQuestions(input: unknown, header: (n: number) => string): QuestionSpec[] {
  if (!input || typeof input !== "object" || !("questions" in input)) return [];
  const list = (input as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const q = item as Partial<QuestionSpec>;
    if (typeof q.question !== "string" || !Array.isArray(q.options)) return [];
    return [
      {
        id: `q${index + 1}`,
        header: q.header ?? header(index + 1),
        question: q.question,
        options: q.options,
        multiSelect: q.multiSelect ?? false,
      },
    ];
  });
}
