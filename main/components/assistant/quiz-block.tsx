"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/assistant/blocks";
import { cn } from "@/lib/utils";

export function QuizBlock({
  questions,
  onAction,
  disabled,
}: {
  questions: QuizQuestion[];
  onAction?: (label: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("Assistant");
  // 题目 id → 用户所选选项下标；答题只在前端判分
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const answeredAll = questions.every((q) => answers[q.questionId] !== undefined);
  const correct = questions.filter((q) => answers[q.questionId] === q.answerIndex).length;

  const explain = () => {
    const details = questions
      .map((q, index) => {
        const chosen = q.options[answers[q.questionId]]?.text;
        const right = q.options[q.answerIndex]?.text;
        return t("actionQuizItem", {
          index: index + 1,
          stem: `${q.stemPre}____${q.stemPost}`,
          chosen,
          answer: right,
          result: chosen === right ? "✓" : "✗",
        });
      })
      .join("；");
    onAction?.(t("actionQuizDone", { correct, total: questions.length, details }));
  };

  return (
    <div className="rounded-2xl bg-muted/40 p-5">
      <div className="mb-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{t("quizTitle")}</span>
        <span>{Object.keys(answers).length}/{questions.length}</span>
      </div>
      <ol className="space-y-6">
        {questions.map((q, index) => {
          const chosen = answers[q.questionId];
          const answered = chosen !== undefined;
          return (
            <li key={q.questionId}>
              <p className="text-[15px] leading-8">
                <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
                {q.stemPre}
                <span className="mx-1 inline-block min-w-14 rounded-md bg-background px-2 text-center font-semibold text-primary">
                  {answered ? q.options[chosen]?.text : " "}
                </span>
                {q.stemPost}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((option, optionIndex) => {
                  const isAnswer = optionIndex === q.answerIndex;
                  const isChosen = optionIndex === chosen;
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={answered}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: optionIndex }))}
                      className={cn(
                        "flex items-center justify-between rounded-xl bg-background px-4 py-2.5 text-left text-sm shadow-xs transition-colors",
                        !answered && "hover:bg-primary/5 hover:text-primary",
                        answered && !isAnswer && !isChosen && "opacity-60",
                        answered && isAnswer && "bg-green-500/10 text-green-700 ring-1 ring-green-500/40 dark:text-green-400",
                        answered && isChosen && !isAnswer && "bg-destructive/10 text-destructive ring-1 ring-destructive/40",
                      )}
                    >
                      <span>
                        {option.text}
                        {answered && option.jyutping && (
                          <span className="ml-2 font-mono text-xs opacity-70">{option.jyutping}</span>
                        )}
                      </span>
                      {answered && isAnswer && <Check className="size-4" />}
                      {answered && isChosen && !isAnswer && <X className="size-4" />}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <p className="mt-2.5 px-1 text-sm leading-6 text-muted-foreground">
                  {chosen === q.answerIndex
                    ? t("quizCorrect")
                    : t("quizWrong", { answer: q.options[q.answerIndex]?.text ?? "" })}
                  {q.explanation ? ` · ${q.explanation}` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answeredAll && (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-background px-4 py-3">
          <span className="mr-auto text-sm font-medium">
            {t("quizSummary", { correct, total: questions.length })}
          </span>
          {onAction && (
            <>
              <Button size="sm" variant="ghost" className="rounded-full" disabled={disabled} onClick={explain}>
                {t("quizExplain")}
              </Button>
              <Button size="sm" className="rounded-full" disabled={disabled} onClick={() => onAction(t("actionQuizMore"))}>
                {t("quizMore")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
