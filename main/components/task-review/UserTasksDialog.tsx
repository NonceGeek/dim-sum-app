"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTasks } from "@/lib/hooks/useTaskReview";
import { TaskCard } from "./TaskCard";
import { TaskDetailDialog } from "./TaskDetailDialog";
import type { AgentTask } from "@/lib/types/task-review";

interface UserTasksDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  corpusName: string;
}

const STATUS_MAP: Record<string, string | undefined> = {
  all: undefined,
  processed: "completed",
  unprocessed: "created,notified,in_progress",
};

export function UserTasksDialog({
  open,
  onClose,
  userId,
  userName,
  corpusName,
}: UserTasksDialogProps) {
  const t = useTranslations("TaskReview");
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading, isFetching } = useTasks(
    {
      assigneeRef: userId,
      corpusName,
      status: STATUS_MAP[tab],
      page,
      pageSize: 10,
    },
    open
  );

  const tasks = data?.items ?? [];
  const totalPages = data?.pagination
    ? Math.ceil(data.pagination.total / (data.pagination.pageSize || 10))
    : 1;

  const handleTabChange = (value: string) => {
    setTab(value);
    setPage(1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {userName} — {t("viewUserTasks")}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="all">{t("all")}</TabsTrigger>
              <TabsTrigger value="processed">{t("processed")}</TabsTrigger>
              <TabsTrigger value="unprocessed">{t("unprocessed")}</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("noTasks")}
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={(t) => {
                        setSelectedTask(t);
                        setDetailOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {!isLoading && tasks.length > 0 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    variant="outline"
                    size="sm"
                  >
                    {isFetching && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    &laquo;
                  </Button>
                  <span className="text-sm text-muted-foreground">
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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTask(null);
        }}
      />
    </>
  );
}
