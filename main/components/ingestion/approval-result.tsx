"use client";

import { CheckCircle2Icon, ChevronRightIcon, CircleAlertIcon, CircleXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** 入库 Agent 的审批结果消息（source.kind = approval_result），result 是写进对话的精简结果 */
export type ApprovalResultData = {
  approval_id: string;
  summary: string;
  result: {
    status?: string;
    note?: string;
    already_applied?: boolean;
    error?: { message?: string };
    result?: { steps?: Array<{ id_range?: number[] } | null> };
  };
};

const ICONS = {
  approved: { Icon: CheckCircle2Icon, className: "text-emerald-600 dark:text-emerald-400" },
  denied: { Icon: CircleXIcon, className: "text-muted-foreground" },
  failed: { Icon: CircleAlertIcon, className: "text-destructive" },
} as const;

/** 审批决定落地后的事件行：一行摘要，展开看原始结果 */
export function ApprovalResultEvent({ data }: { data: ApprovalResultData }) {
  const t = useTranslations("IngestionTasks.approvalResult");
  const { status = "approved", note, already_applied, error } = data.result;
  const { Icon, className } = ICONS[status as keyof typeof ICONS] ?? ICONS.approved;
  const range = data.result.result?.steps?.find((step) => step?.id_range?.length === 2)?.id_range;
  const details = [
    data.summary,
    already_applied ? t("alreadyApplied") : "",
    range ? t("idRange", { from: range[0], to: range[1] }) : "",
    status === "denied" && note ? t("note", { note }) : "",
    status === "failed" && error?.message ? error.message : "",
  ].filter(Boolean);
  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <Icon className={cn("size-4 shrink-0", className)} />
        <span className="shrink-0 font-medium text-foreground">
          {t.has(`status.${status}`) ? t(`status.${status}`) : status}
        </span>
        {details.length ? <span className="min-w-0 truncate">· {details.join(" · ")}</span> : null}
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
        {JSON.stringify(data.result, null, 2)}
      </pre>
    </details>
  );
}
