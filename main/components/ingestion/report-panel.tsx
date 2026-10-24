"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon, Maximize2Icon, RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormattedTime } from "./task-shared";
import type { TaskDetail } from "./types";

type Report = {
  id: string;
  version: number;
  kind: "final" | "draft";
  status: "generating" | "ready" | "ready_without_narrative" | "failed";
  formats: string[];
  error: string | null;
  generatedBy: string | null;
  createdAt: string;
};

type ReportsView = {
  reports: Report[];
  current: { version: number; kind: string; markdown: string | null } | null;
};

const FORMATS = ["md", "xlsx", "json"] as const;

const MARKDOWN: Components = {
  h1: (props) => <h1 className="mb-3 text-lg font-semibold" {...props} />,
  h2: (props) => <h2 className="mt-5 mb-2 border-b pb-1 text-base font-semibold" {...props} />,
  h3: (props) => <h3 className="mt-4 mb-1.5 text-sm font-semibold" {...props} />,
  p: (props) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 pl-3 text-xs text-muted-foreground" {...props} />
  ),
  code: (props) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props) => <th className="border bg-muted px-2 py-1 text-left font-medium" {...props} />,
  td: (props) => <td className="border px-2 py-1 align-top" {...props} />,
};

function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** 入库报告：任务结束后自动生成；结束前可生成草稿预览 */
export function ReportPanel({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks.report");
  const queryClient = useQueryClient();
  const [reading, setReading] = useState(false);
  const key = ["ingestion-task-report", task.id];

  const view = useQuery({
    queryKey: key,
    queryFn: async () => json<ReportsView>(await fetch(`/api/admin/ingestion-tasks/${task.id}/report`)),
    // 生成中（或刚结束、正式报告还没出现）时轮询
    refetchInterval: (query) => {
      const reports = query.state.data?.reports ?? [];
      const generating = reports.some((r) => r.status === "generating");
      const awaitingFinal = task.closed && !reports.some((r) => r.kind === "final");
      return generating || awaitingFinal ? 4000 : false;
    },
  });

  const regenerate = useMutation({
    mutationFn: async (kind: "final" | "draft") =>
      json<ReportsView>(
        await fetch(`/api/admin/ingestion-tasks/${task.id}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      toast.success(t("scheduled"));
      // 生成在响应后开始，稍后刷新以拿到 generating 状态
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: key }), 1500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (view.isLoading) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (view.isError) return <p className="text-sm text-destructive">{(view.error as Error).message}</p>;

  const reports = view.data?.reports ?? [];
  const latest = reports[0];
  const current = view.data?.current;
  const readable = current && reports.find((r) => r.version === current.version);
  const generating = reports.some((r) => r.status === "generating");
  const download = (version: number, format: string) =>
    `/api/admin/ingestion-tasks/${task.id}/report/download?${new URLSearchParams({ version: String(version), format })}`;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {latest ? (
          <span className="text-muted-foreground">
            v{latest.version} · {t(`kinds.${latest.kind}`)} · {t(`statuses.${latest.status}`)} ·{" "}
            <FormattedTime value={latest.createdAt} />
          </span>
        ) : (
          <span className="text-muted-foreground">{task.closed ? t("pending") : t("notClosed")}</span>
        )}
        {generating && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={generating || regenerate.isPending}
          onClick={() => regenerate.mutate(task.closed ? "final" : "draft")}
        >
          <RefreshCwIcon className="size-4" />
          {task.closed ? t("regenerate") : t("draft")}
        </Button>
      </div>

      {latest?.status === "failed" && latest.error && <p className="text-xs text-destructive">{latest.error}</p>}
      {readable?.status === "ready_without_narrative" && (
        <p className="text-xs text-muted-foreground">{t("withoutNarrative")}</p>
      )}

      {readable && (
        <div className="flex flex-wrap gap-2">
          {FORMATS.filter((f) => readable.formats.includes(f)).map((f) => (
            <Button key={f} size="sm" variant="secondary" asChild>
              <a href={download(readable.version, f)}>
                <DownloadIcon className="size-4" />
                {t(`formats.${f}`)}
              </a>
            </Button>
          ))}
          {current?.markdown && (
            <Button size="sm" variant="ghost" onClick={() => setReading(true)}>
              <Maximize2Icon className="size-4" />
              {t("read")}
            </Button>
          )}
        </div>
      )}

      {current?.markdown ? (
        <div className="max-h-[60vh] overflow-y-auto rounded-md border p-3">
          <Markdown text={current.markdown} />
        </div>
      ) : (
        readable && <p className="text-xs text-muted-foreground">{t("unreadable")}</p>
      )}

      <Dialog open={reading} onOpenChange={setReading}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("title", { version: current?.version ?? 0 })}</DialogTitle>
          </DialogHeader>
          {current?.markdown && <Markdown text={current.markdown} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
