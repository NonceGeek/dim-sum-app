"use client";

import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
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

export const reportDownloadHref = (taskId: string, version: number, format: string) =>
  `/api/admin/ingestion-tasks/${taskId}/report/download?${new URLSearchParams({ version: String(version), format })}`;

/** 任务的报告版本列表（新的在前）；时间线与报告面板共用同一个查询 */
export function useTaskReports(taskId: string) {
  return useQuery({
    queryKey: ["ingestion-task-report", taskId],
    queryFn: async () => json<ReportsView>(await fetch(`/api/admin/ingestion-tasks/${taskId}/report`)),
    // 生成中时轮询
    refetchInterval: (query) =>
      query.state.data?.reports.some((r) => r.status === "generating") ? 4000 : false,
  });
}

/** 入库报告：入库 Agent 在对话中生成草稿，结束任务时生成正式版 */
export function ReportPanel({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks.report");
  const view = useTaskReports(task.id);

  if (view.isLoading) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (view.isError) return <p className="text-sm text-destructive">{(view.error as Error).message}</p>;

  const reports = view.data?.reports ?? [];
  const latest = reports[0];
  const current = view.data?.current;
  const readable = current && reports.find((r) => r.version === current.version);
  const generating = reports.some((r) => r.status === "generating");
  const download = (version: number, format: string) => reportDownloadHref(task.id, version, format);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {latest ? (
          <span className="text-muted-foreground">
            v{latest.version} · {t(`kinds.${latest.kind}`)} · {t(`statuses.${latest.status}`)} ·{" "}
            <FormattedTime value={latest.createdAt} />
          </span>
        ) : (
          <span className="text-muted-foreground">{task.closed ? t("none") : t("notClosed")}</span>
        )}
        {generating && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
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
        </div>
      )}

      {current?.markdown ? (
        <div className="max-h-[60vh] overflow-y-auto rounded-md border p-3">
          <Markdown text={current.markdown} />
        </div>
      ) : (
        readable && <p className="text-xs text-muted-foreground">{t("unreadable")}</p>
      )}
    </div>
  );
}
