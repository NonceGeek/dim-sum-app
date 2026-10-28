"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { json } from "@/components/library-ops/ops-shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AgentChat } from "@/components/ingestion/agent-chat";
import { AgentClient } from "@/components/ingestion/agent-client";
import { TaskForm } from "@/components/ingestion/task-form";
import { TaskTimeline } from "@/components/ingestion/task-timeline";
import { TaskStatusBadge } from "@/components/ingestion/task-shared";
import type { RunView, TaskDetail } from "@/components/ingestion/types";

export default function IngestionTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("IngestionTasks");
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 从表单点「开始智能清洗」进来时自动发出第一条指令；去掉参数后仍保持对话视图
  const [autoStart, setAutoStart] = useState(false);
  if (searchParams.get("start") === "1" && !autoStart) setAutoStart(true);
  const turnId = searchParams.get("turn") ?? undefined;
  const toolCallId = searchParams.get("toolCall") ?? undefined;
  const target = useMemo(() => ({ turnId, toolCallId }), [turnId, toolCallId]);
  const client = useMemo(() => new AgentClient(id), [id]);
  const [run, setRun] = useState<RunView | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "complete" | null>(null);

  const detail = useQuery({
    queryKey: ["ingestion-task", id],
    queryFn: async () => json<TaskDetail>(await fetch(`/api/admin/ingestion-tasks/${id}`)),
  });

  // Agent 推送的状态变化（开始对话、待审批、写入完成、结束）同步到本页的任务信息与入库记录
  const runKey = run && `${run.status}:${run.approvals.map((a) => `${a.id}=${a.status}`).join(",")}`;
  useEffect(() => {
    if (!runKey) return;
    void queryClient.invalidateQueries({ queryKey: ["ingestion-task", id] });
    void queryClient.invalidateQueries({ queryKey: ["ingestion-task-records", id] });
    void queryClient.invalidateQueries({ queryKey: ["ingestion-task-report", id] });
  }, [runKey, id, queryClient]);

  const lifecycle = useMutation({
    mutationFn: async (action: "cancel" | "complete") =>
      json<TaskDetail>(await fetch(`/api/admin/ingestion-tasks/${id}/${action}`, { method: "POST" })),
    onSuccess: (task) => {
      queryClient.setQueryData(["ingestion-task", id], task);
      void queryClient.invalidateQueries({ queryKey: ["ingestion-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["library-ops"] });
      setConfirm(null);
      toast.success(t("saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) return <p className="text-muted-foreground">{t("loading")}</p>;
  if (!detail.data)
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-destructive">{(detail.error as Error | null)?.message}</p>
      </div>
    );
  const task = detail.data;
  if (task.draft && !autoStart) return <TaskForm task={task} />;
  // 已有会话时以 Agent 的判断为准（执行中、写入结果未知时不能取消）
  const cancelBlocker = run ? (run.can_cancel ? null : run.cancel_blocker) : null;
  const completeBlocker = run ? (run.can_complete ? null : run.complete_blocker) : t("completeNeedsRun");

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BackLink />
        <h2 className="min-w-0 truncate text-xl font-bold">{task.title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{task.taskNo}</span>
        <TaskStatusBadge status={task.displayStatus} />
        {!task.closed && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!cancelBlocker || lifecycle.isPending}
              title={cancelBlocker ?? undefined}
              onClick={() => setConfirm("cancel")}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!!completeBlocker || lifecycle.isPending}
              title={completeBlocker ?? undefined}
              onClick={() => setConfirm("complete")}
            >
              {t("actions.complete")}
            </Button>
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)]">
        <section className="flex h-[70dvh] min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:h-auto">
          <AgentChat
            client={client}
            taskStatus={task.status}
            closed={task.closed}
            target={target}
            onRun={setRun}
            autoStart={autoStart}
            onAutoStarted={() => router.replace(`/admin/ingestion-tasks/${id}`)}
          />
        </section>

        <aside className="min-h-0 lg:overflow-y-auto">
          <TaskTimeline task={task} run={run} />
        </aside>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !lifecycle.isPending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm && t(`actions.${confirm}`)}</AlertDialogTitle>
            <AlertDialogDescription>{confirm && t(`actions.${confirm}Confirm`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lifecycle.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={lifecycle.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) lifecycle.mutate(confirm);
              }}
            >
              {lifecycle.isPending ? t("saving") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackLink() {
  const t = useTranslations("IngestionTasks");
  return (
    <Button asChild size="icon" variant="ghost" aria-label={t("back")}>
      <Link href="/admin/ingestion-tasks">
        <ArrowLeftIcon className="size-4" />
      </Link>
    </Button>
  );
}
