"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useLibraryOps } from "@/lib/hooks/use-library-ops";
import { json } from "@/components/library-ops/ops-shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormattedTime, ProvenanceDialog, TaskStatusBadge } from "@/components/ingestion/task-shared";
import type { TaskSummary } from "@/components/ingestion/types";

// 与 lib/ingestion/tasks.ts 一致；那个模块依赖 node:crypto，不能进客户端包
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

type TaskStats = {
  total: number;
  recent: number;
  attention: number;
  errors: number;
  processing: number;
  drafts: number;
  todayRecords: number;
  todayBatches: number;
};

function StatCard({ label, value, hint, className }: { label: string; value: number; hint: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums", className)}>{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function IngestionTasksPage() {
  const t = useTranslations("IngestionTasks");
  const { data: ops } = useLibraryOps();
  const [scope, setScope] = useState<"me" | "all">("me");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [provenance, setProvenance] = useState(false);
  const list = useQuery({
    queryKey: ["ingestion-tasks", scope, status, q, page],
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({ assignee: scope, page: String(page) });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      return json<{ items: TaskSummary[]; total: number; pageSize: number }>(
        await fetch(`/api/admin/ingestion-tasks?${params}`),
      );
    },
  });
  const stats = useQuery({
    queryKey: ["ingestion-task-stats", scope],
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    queryFn: async () => json<TaskStats>(await fetch(`/api/admin/ingestion-tasks/stats?assignee=${scope}`)),
  });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("title")}</h2>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setProvenance(true)}>
            {t("provenance.title")}
          </Button>
          <Button asChild>
            <Link href="/admin/ingestion-tasks/new">
              <PlusIcon className="size-4" />
              {t("create.title")}
            </Link>
          </Button>
        </div>
      </div>

      {stats.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("stats.total")}
            value={stats.data.total}
            hint={t("stats.recent", { count: stats.data.recent })}
          />
          <StatCard
            label={t("stats.attention")}
            value={stats.data.attention}
            hint={t("stats.errors", { count: stats.data.errors })}
            className="text-amber-600"
          />
          <StatCard
            label={t("stats.processing")}
            value={stats.data.processing}
            hint={t("stats.drafts", { count: stats.data.drafts })}
            className="text-violet-600"
          />
          <StatCard
            label={t("stats.todayRecords")}
            value={stats.data.todayRecords}
            hint={t("stats.todayBatches", { count: stats.data.todayBatches })}
            className="text-emerald-600"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {ops?.isAdmin && (
          <div className="flex rounded-md border p-0.5">
            {(["me", "all"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={scope === s ? "secondary" : "ghost"}
                onClick={() => {
                  setPage(1);
                  setScope(s);
                }}
              >
                {t(`scope.${s}`)}
              </Button>
            ))}
          </div>
        )}
        <select
          aria-label={t("statusFilter")}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">{t("allStatuses")}</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(search.trim());
          }}
        >
          <Input
            className="h-9 w-64"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="icon" variant="outline" aria-label={t("search")}>
            <SearchIcon className="size-4" />
          </Button>
        </form>
      </div>

      {list.isLoading && <p className="text-muted-foreground">{t("loading")}</p>}
      {list.isError && <p className="text-destructive">{(list.error as Error).message}</p>}
      {list.data?.items.length === 0 && (
        <p className="rounded-lg border p-8 text-center text-muted-foreground">{t("empty")}</p>
      )}
      {!!list.data?.items.length && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.title")}</TableHead>
                <TableHead>{t("columns.targetDataset")}</TableHead>
                <TableHead>{t("columns.modalities")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.createdBy")}</TableHead>
                <TableHead>{t("columns.updatedAt")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-md">
                    <p className="truncate font-medium">{task.title}</p>
                    <span className="font-mono text-xs text-muted-foreground">{task.taskNo}</span>
                  </TableCell>
                  <TableCell>{task.targetDatasetName}</TableCell>
                  <TableCell>{task.modalities.map((m) => t(`modality.${m}`)).join(" + ") || "—"}</TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.displayStatus} />
                  </TableCell>
                  <TableCell>{task.createdByName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <FormattedTime value={task.run?.updatedAt ?? task.updatedAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="link" className="h-auto p-0">
                      <Link href={`/admin/ingestion-tasks/${task.id}`}>
                        {t("viewDetail")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("prev")}
          </Button>
          <span>
            {page} / {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </Button>
        </div>
      )}
      {provenance && <ProvenanceDialog onClose={() => setProvenance(false)} />}
    </div>
  );
}
