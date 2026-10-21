"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, FolderUpIcon, Loader2Icon, UploadIcon, XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FormattedTime, formatBytes } from "./task-shared";
import type { TaskDetail, TaskRecord } from "./types";

type Upload = { path: string; size: number; state: "uploading" | "done" | "error"; error?: string };

const UPLOAD_CONCURRENCY = 3;

/** 原始文件：签名 → 浏览器直传 OSS → 回报完成；路径相对任务工作区的 input/ */
export function FilesPanel({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks.files");
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const uploading = uploads.some((u) => u.state === "uploading");

  const upload = async (files: File[]) => {
    const items = files.map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    setUploads((current) => [
      ...current.filter((u) => !items.some((i) => i.path === u.path)),
      ...items.map(({ file, path }) => ({ path, size: file.size, state: "uploading" as const })),
    ]);
    await uploadFiles(task.id, items, (path, error) =>
      setUploads((current) =>
        current.map((u) => (u.path === path ? { ...u, state: error ? "error" : "done", error } : u)),
      ),
    );
    void queryClient.invalidateQueries({ queryKey: ["ingestion-task", task.id] });
  };

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length) void upload(files);
  };

  const inProgress = uploads.filter((u) => u.state !== "done" || !task.files.some((f) => f.path === `input/${u.path}`));

  return (
    <div className="space-y-3">
      {task.canUploadFiles ? (
        <div className="flex gap-2">
          <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
          <input
            ref={folderInput}
            type="file"
            hidden
            onChange={onPick}
            {...({ webkitdirectory: "" } as Record<string, string>)}
          />
          <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <UploadIcon className="size-4" />
            {t("pickFiles")}
          </Button>
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => folderInput.current?.click()}>
            <FolderUpIcon className="size-4" />
            {t("pickFolder")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{task.closed ? t("closed") : t("locked")}</p>
      )}
      {task.canUploadFiles && <p className="text-xs text-muted-foreground">{t("hint")}</p>}
      {inProgress.length > 0 && (
        <ul className="space-y-1">
          {inProgress.map((u) => (
            <li key={u.path} className="flex items-center gap-2 text-sm">
              {u.state === "uploading" ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : u.state === "done" ? (
                <CheckCircle2Icon className="size-4 shrink-0 text-success" />
              ) : (
                <XCircleIcon className="size-4 shrink-0 text-destructive" />
              )}
              <span className="min-w-0 flex-1 truncate" title={u.path}>
                {u.path}
              </span>
              {u.error && (
                <span className="max-w-[50%] truncate text-xs text-destructive" title={u.error}>
                  {u.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {task.files.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {task.files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
                {file.path.replace(/^input\//, "")}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  file.status === "UPLOADED" ? "text-muted-foreground" : file.status === "FAILED" ? "text-destructive" : "text-warning",
                )}
              >
                {t(`status.${file.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 并发上传；每个文件结束时回调，失败时带错误信息 */
export async function uploadFiles(
  taskId: string,
  items: { file: File; path: string }[],
  onSettled: (path: string, error?: string) => void,
) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await uploadOne(taskId, item.file, item.path);
        onSettled(item.path);
      } catch (error) {
        onSettled(item.path, (error as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
}

async function uploadOne(taskId: string, file: File, path: string) {
  const sign = await json<{ path: string; method: "PUT"; url: string; headers: Record<string, string> }>(
    await fetch(`/api/admin/ingestion-tasks/${taskId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, size: file.size }),
    }),
  );
  // 签名包含这些请求头（含 x-oss-forbid-overwrite），必须原样带上
  const put = await fetch(sign.url, { method: sign.method, headers: sign.headers, body: file });
  if (!put.ok) throw new Error(`OSS ${put.status}`);
  await json(
    await fetch(`/api/admin/ingestion-tasks/${taskId}/files/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: sign.path }),
    }),
  );
}

export function ApprovalsPanel({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks.approvals");
  if (!task.approvals.length) return <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="space-y-2">
      {task.approvals.map((a) => (
        <li key={a.id} className="space-y-1 rounded-md border p-3 text-sm">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 font-medium">{a.summary ?? a.kind ?? a.proposalId}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{t(`status.${a.status}`)}</span>
          </div>
          {Object.keys(a.expected).length > 0 && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {Object.entries(a.expected)
                .map(([name, count]) => `${name} ${count}`)
                .join(" · ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {a.decidedByName && a.decidedAt ? (
              <>
                {t("decided", { name: a.decidedByName })} · <FormattedTime value={a.decidedAt} />
              </>
            ) : (
              <FormattedTime value={a.createdAt} />
            )}
          </p>
          {a.decisionNote && <p className="whitespace-pre-line text-xs">{a.decisionNote}</p>}
        </li>
      ))}
    </ul>
  );
}

export function RecordsPanel({ taskId }: { taskId: string }) {
  const t = useTranslations("IngestionTasks.records");
  const records = useInfiniteQuery({
    queryKey: ["ingestion-task-records", taskId],
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    queryFn: async ({ pageParam }: { pageParam: string }) =>
      json<{ items: TaskRecord[]; nextCursor: string | null }>(
        await fetch(`/api/admin/ingestion-tasks/${taskId}/records?${new URLSearchParams({ cursor: pageParam, limit: "50" })}`),
      ),
  });
  const items = records.data?.pages.flatMap((p) => p.items) ?? [];
  if (records.isLoading) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (records.isError) return <p className="text-sm text-destructive">{(records.error as Error).message}</p>;
  if (!items.length) return <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-md border">
        {items.map((r) => (
          <li key={r.corpusId} className="space-y-0.5 px-3 py-2 text-sm">
            <p className="line-clamp-2">{r.text}</p>
            <p className="font-mono text-xs text-muted-foreground">
              #{r.corpusId} · <FormattedTime value={r.committedAt} />
            </p>
          </li>
        ))}
      </ul>
      {records.hasNextPage && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          disabled={records.isFetchingNextPage}
          onClick={() => void records.fetchNextPage()}
        >
          {t("more")}
        </Button>
      )}
    </div>
  );
}

export function EventsPanel({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks.events");
  if (!task.events.length) return <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ol className="space-y-2 border-l pl-4">
      {task.events.map((e) => (
        <li key={e.id} className="text-sm">
          <p>
            {t.has(`types.${e.operationType}`) ? t(`types.${e.operationType}`) : e.operationType}
            {e.operator && <span className="text-muted-foreground"> · {e.operator}</span>}
          </p>
          {e.note && <p className="whitespace-pre-line text-xs">{e.note}</p>}
          <p className="text-xs text-muted-foreground">
            <FormattedTime value={e.createdAt} />
          </p>
        </li>
      ))}
    </ol>
  );
}
