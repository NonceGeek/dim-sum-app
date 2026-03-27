"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useCategoryStore } from "@/lib/stores/category-store";
import type { AgentTask } from "@/lib/types/task-review";

const VIOLATION_TYPE_KEY: Record<string, string> = {
  phonetic_mismatch: "phoneticMismatch",
  grammar_violation: "grammarViolation",
  llm_generic_violation: "llmGenericViolation",
};

interface TaskTableProps {
  tasks: AgentTask[];
  onTaskClick: (task: AgentTask) => void;
}

export function TaskTable({ tasks, onTaskClick }: TaskTableProps) {
  const t = useTranslations("TaskReview");
  const getNickname = useCategoryStore((s) => s.getNickname);

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">{t("bodyText")}</TableHead>
            <TableHead className="w-36">{t("source")}</TableHead>
            <TableHead className="w-32">{t("violationType")}</TableHead>
            <TableHead className="w-24 text-center">{t("status")}</TableHead>
            <TableHead className="w-36 pr-4">{t("createdAt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer group"
              onClick={() => onTaskClick(task)}
            >
              <TableCell className="pl-4 max-w-lg">
                <p className="line-clamp-2 whitespace-normal leading-relaxed">
                  {task.context.sentenceText || task.context.text || "—"}
                </p>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-sm">
                  {task.context.corpusName
                    ? getNickname(task.context.corpusName)
                    : "—"}
                </span>
              </TableCell>
              <TableCell>
                {task.violationType ? (
                  <Badge variant="outline" className="font-normal text-xs">
                    {t(VIOLATION_TYPE_KEY[task.violationType] || task.violationType)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {task.status === "completed" ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                  >
                    {t("processed")}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                  >
                    {t("unprocessed")}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="pr-4 text-muted-foreground text-sm tabular-nums">
                {task.createdAt
                  ? new Date(task.createdAt).toLocaleDateString()
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
