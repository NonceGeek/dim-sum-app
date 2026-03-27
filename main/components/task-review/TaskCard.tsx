"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import type { AgentTask } from "@/lib/types/task-review";
import { useTranslations } from "next-intl";
import { useCategoryStore } from "@/lib/stores/category-store";

interface TaskCardProps {
  task: AgentTask;
  onClick: (task: AgentTask) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const t = useTranslations("TaskReview");
  const getNickname = useCategoryStore((s) => s.getNickname);

  const isCompleted = task.status === "completed";

  return (
    <Card
      className="px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors duration-150 bg-card"
      onClick={() => onClick(task)}
    >
      <div className="flex items-center gap-3">
        {/* 左侧：主字符 */}
        {task.context.problemChar && (
          <span className="text-xl font-bold text-primary shrink-0 w-8 text-center">
            {task.context.problemChar}
          </span>
        )}

        {/* 中间内容 */}
        <div className="flex-1 min-w-0">
          {(task.context.sentenceText || task.context.text) && (
            <p className="text-sm line-clamp-2">
              {task.context.sentenceText || task.context.text}
            </p>
          )}
          {task.context.corpusName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dataSource", { source: getNickname(task.context.corpusName) })}
            </p>
          )}
        </div>

        {/* 右侧：状态 + 箭头 */}
        <div className="flex items-center gap-2 shrink-0">
          {isCompleted && (
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs"
            >
              {t("processed")}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
