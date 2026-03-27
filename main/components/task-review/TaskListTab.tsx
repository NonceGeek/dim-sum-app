"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTasks } from "@/lib/hooks/useTaskReview";
import { useCategoryStore } from "@/lib/stores/category-store";
import { TaskCard } from "./TaskCard";
import { TaskTable } from "./TaskTable";
import { TaskDetailDialog } from "./TaskDetailDialog";
import type { AgentTask, TaskListParams } from "@/lib/types/task-review";

const UNCOMPLETED_STATUS = "created,notified,in_progress";
const COMPLETED_STATUS = "completed";

export function TaskListTab() {
  const t = useTranslations("TaskReview");
  const { fetchCategories, categories } = useCategoryStore();

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const [taskTab, setTaskTab] = useState("uncompleted");
  const [corpusName, setCorpusName] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const statusFilter = taskTab === "uncompleted" ? UNCOMPLETED_STATUS : COMPLETED_STATUS;

  const params: TaskListParams = {
    status: statusFilter,
    page,
    pageSize: 10,
    corpusName: corpusName || undefined,
  };

  const { data, isLoading, isFetching } = useTasks(params);

  const tasks = data?.items ?? [];
  const totalPages = data?.pagination
    ? Math.ceil(data.pagination.total / (data.pagination.pageSize || 10))
    : 1;

  const handleTabChange = (value: string) => {
    setTaskTab(value);
    setPage(1);
  };

  const handleTaskClick = (task: AgentTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="space-y-4">
      {/* Header: tabs + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={taskTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="uncompleted">{t("uncompleted")}</TabsTrigger>
            <TabsTrigger value="completed">{t("completed")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Select
            value={corpusName}
            onValueChange={(v) => { setCorpusName(v === "all" ? "" : v); setPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("allDatasets")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allDatasets")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.nickname || cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noTasks")}
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block">
            <TaskTable tasks={tasks} onTaskClick={handleTaskClick} />
          </div>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            variant="outline"
            size="sm"
          >
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages || isFetching}
            variant="outline"
            size="sm"
          >
            &raquo;
          </Button>
        </div>
      )}

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onClose={handleDetailClose}
      />
    </div>
  );
}
