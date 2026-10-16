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
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 text-sm font-medium">{t("quizTitle")}</div>
      <ol className="space-y-4">
        {questions.map((q, index) => {
          const chosen = answers[q.questionId];
          const answered = chosen !== undefined;
          return (
            <li key={q.questionId}>
              <p className="text-base leading-relaxed">
                <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                {q.stemPre}
                <span className="mx-1 inline-block min-w-12 border-b-2 border-primary/60 text-center font-semibold">
                  {answered ? q.options[chosen]?.text : " "}
                </span>
                {q.stemPost}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        !answered && "hover:bg-accent",
                        answered && isAnswer && "border-green-600 bg-green-600/10",
                        answered && isChosen && !isAnswer && "border-destructive bg-destructive/10",
                      )}
                    >
                      <span>
                        {option.text}
                        {answered && option.jyutping && (
                          <span className="ml-2 text-xs text-muted-foreground">{option.jyutping}</span>
                        )}
                      </span>
                      {answered && isAnswer && <Check className="h-4 w-4 text-green-600" />}
                      {answered && isChosen && !isAnswer && <X className="h-4 w-4 text-destructive" />}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <p className="mt-2 text-sm text-muted-foreground">
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
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="mr-auto text-sm font-medium">
            {t("quizSummary", { correct, total: questions.length })}
          </span>
          {onAction && (
            <>
              <Button size="sm" variant="outline" disabled={disabled} onClick={explain}>
                {t("quizExplain")}
              </Button>
              <Button size="sm" disabled={disabled} onClick={() => onAction(t("actionQuizMore"))}>
                {t("quizMore")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
