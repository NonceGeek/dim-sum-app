"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useLibraryOps } from "@/lib/hooks/use-library-ops";
import type { DisplayStatus } from "@/lib/ingestion/display-status";
import { cn } from "@/lib/utils";
import { UserSelect, json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Provenance, TaskDetail } from "./types";

const DISPLAY_TONE: Record<DisplayStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PROCESSING: "bg-info/15 text-info",
  WAITING_APPROVAL: "bg-warning/15 text-warning",
  WAITING_INPUT: "bg-primary/10 text-primary",
  ERROR: "bg-destructive/10 text-destructive",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export function TaskStatusBadge({ status }: { status: DisplayStatus }) {
  const t = useTranslations("IngestionTasks.displayStatus");
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", DISPLAY_TONE[status])}>
      {t(status)}
    </span>
  );
}

/** 新建入库任务；带 lead 时从入库待办发起，预计语料名缺省取待办的拟定名称 */
export function CreateTaskDialog({
  lead,
  onClose,
}: {
  lead?: { id: string; leadNo: string; proposedDatasetName: string; assigneeId: string };
  onClose: () => void;
}) {
  const t = useTranslations("IngestionTasks");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: ops } = useLibraryOps();
  const [title, setTitle] = useState(lead?.proposedDatasetName ?? "");
  const [description, setDescription] = useState("");
  const [dataset, setDataset] = useState(lead?.proposedDatasetName ?? "");
  // 管理员替他人的待办建任务时，负责人默认为待办被指派人
  const [assigneeId, setAssigneeId] = useState(lead?.assigneeId ?? "");
  const mutation = useMutation({
    mutationFn: async () =>
      json<TaskDetail>(
        await fetch("/api/admin/ingestion-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            targetDatasetName: dataset.trim() || undefined,
            assigneeId: assigneeId || undefined,
            leadId: lead?.id,
          }),
        }),
      ),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["ingestion-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["ingestion-leads"] });
      router.push(`/admin/ingestion-tasks/${task.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>
              {lead ? t("create.fromLead", { no: lead.leadNo }) : t("create.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t("fields.title")} *</Label>
            <Input id="task-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-dataset">{t("fields.targetDatasetName")} *</Label>
            <Input
              id="task-dataset"
              required
              maxLength={200}
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("create.datasetHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">{t("fields.description")}</Label>
            <Textarea
              id="task-description"
              rows={4}
              maxLength={2000}
              placeholder={t("create.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {ops?.isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">{t("fields.assignee")}</Label>
              <UserSelect id="task-assignee" capability="ingestion_assignee" value={assigneeId} onChange={setAssigneeId} />
              <p className="text-xs text-muted-foreground">{t("create.assigneeHint")}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !title.trim() || !dataset.trim()}>
              {mutation.isPending ? t("saving") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 按语料 ID 查入库溯源：哪个任务、哪次审批、谁批准，可跳回对话中的写入位置 */
export function ProvenanceDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("IngestionTasks");
  const [input, setInput] = useState("");
  const [corpusId, setCorpusId] = useState("");
  const query = useQuery({
    queryKey: ["ingestion-provenance", corpusId],
    enabled: !!corpusId,
    queryFn: async () => json<Provenance>(await fetch(`/api/admin/ingestion-provenance/${corpusId}`)),
  });
  const p = query.data?.provenance;
  const conversationHref = p
    ? `/admin/ingestion-tasks/${p.task.id}?${new URLSearchParams({
        ...(p.turnId ? { turn: p.turnId } : {}),
        ...(p.toolCallId ? { toolCall: p.toolCallId } : {}),
      })}`
    : "";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("provenance.title")}</DialogTitle>
          <DialogDescription>{t("provenance.description")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCorpusId(input.trim());
          }}
        >
          <Input
            aria-label={t("provenance.corpusId")}
            placeholder={t("provenance.corpusId")}
            inputMode="numeric"
            pattern="\d+"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={!/^\d+$/.test(input.trim())}>
            {t("provenance.search")}
          </Button>
        </form>
        {query.isFetching && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {query.isError && <p className="text-sm text-destructive">{(query.error as Error).message}</p>}
        {query.data && !p && <p className="text-sm text-muted-foreground">{t("provenance.none")}</p>}
        {p && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("provenance.task")}</dt>
            <dd>
              <Link href={`/admin/ingestion-tasks/${p.task.id}`} className="underline underline-offset-4">
                {p.task.taskNo} · {p.task.title}
              </Link>
            </dd>
            <dt className="text-muted-foreground">{t("provenance.proposal")}</dt>
            <dd>{p.approval?.summary ?? p.proposalId}</dd>
            <dt className="text-muted-foreground">{t("provenance.approvedBy")}</dt>
            <dd>
              {p.approvedBy.name} · <FormattedTime value={p.approvedAt} />
            </dd>
            <dt className="text-muted-foreground">{t("provenance.committedAt")}</dt>
            <dd>
              <FormattedTime value={p.committedAt} />
            </dd>
            <dt className="text-muted-foreground">{t("provenance.recordRow")}</dt>
            <dd className="font-mono text-xs">
              {p.batchId} · #{p.recordRow}
            </dd>
          </dl>
        )}
        {p?.conversationAvailable && (
          <DialogFooter>
            <Button asChild variant="outline">
              <Link href={conversationHref}>{t("provenance.openConversation")}</Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FormattedTime({ value, dateOnly }: { value: string; dateOnly?: boolean }) {
  const locale = useLocale();
  return (
    <time dateTime={value} title={value}>
      {new Intl.DateTimeFormat(locale, dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )}
    </time>
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
