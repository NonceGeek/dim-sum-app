"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type Subtask = {
  task_id: string;
  title: string;
  status: string;
  summary?: string;
  artifacts?: string[];
  warnings?: string[];
  unresolved_questions?: string[];
  duration_ms?: number;
  steps?: Array<{ step: number; tools: string[]; finish_reason: string }>;
};

/** delegate_tasks 的结果：每个子任务一行，展开看摘要、步骤与产物 */
export function SubtaskCard({ output }: { output: unknown }) {
  const t = useTranslations("IngestionTasks.subtask");
  const tasks = parseTasks(output);
  if (!tasks) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{t("count", { count: tasks.length })}</p>
      {tasks.map((task) => (
        <details key={task.task_id} className="rounded-md border px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
            <Badge variant="secondary">{t.has(`status.${task.status}`) ? t(`status.${task.status}`) : task.status}</Badge>
          </summary>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {task.summary ? <p className="whitespace-pre-wrap">{task.summary}</p> : null}
            {task.duration_ms ? <p>{t("duration", { seconds: (task.duration_ms / 1000).toFixed(1) })}</p> : null}
            {task.steps?.map((step) => (
              <p key={step.step}>
                {t("step", { n: step.step + 1 })}: {step.tools.join(", ") || step.finish_reason}
              </p>
            ))}
            {task.artifacts?.map((path) => (
              <p key={path} className="truncate font-mono" title={path}>
                {path}
              </p>
            ))}
            {task.warnings?.map((warning) => (
              <p key={warning} className="text-amber-700 dark:text-amber-400">
                {warning}
              </p>
            ))}
            {task.unresolved_questions?.length ? (
              <div className="space-y-0.5 pt-1">
                <p className="font-medium text-foreground">{t("unresolved")}</p>
                {task.unresolved_questions.map((question) => (
                  <p key={question}>· {question}</p>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function parseTasks(value: unknown): Subtask[] | null {
  if (!value || typeof value !== "object" || !("tasks" in value)) return null;
  const tasks = (value as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return null;
  return tasks.filter(
    (task): task is Subtask =>
      !!task && typeof task === "object" && "task_id" in task && "title" in task && "status" in task,
  );
}
