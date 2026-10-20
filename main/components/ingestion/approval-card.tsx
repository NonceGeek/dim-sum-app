"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Approval } from "./types";

/**
 * 入库提案的人工审批。决定只在 dim-sum-app 写入（Agent 的数据库角色写不了），
 * 写入成功后立刻让 Agent 执行决定并续跑；执行没发起或失败时可以重试执行。
 */
export function ApprovalCard({
  taskId,
  approval,
  busy,
  onExecute,
}: {
  taskId: string;
  approval: Approval;
  busy: boolean;
  onExecute: (approvalId: string) => void;
}) {
  const t = useTranslations("IngestionTasks.approval");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: async (decision: "approve" | "deny") =>
      json(
        await fetch(`/api/admin/ingestion-tasks/${taskId}/approvals/${approval.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note: note.trim() || undefined }),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ingestion-task", taskId] });
      onExecute(approval.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pending = approval.status === "pending";
  const approved = approval.status === "authorized";
  const expected = Object.entries(approval.expected);

  return (
    <div className="space-y-3 rounded-xl border border-warning/50 bg-warning/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{approval.proposal.summary ?? t("untitled", { kind: approval.proposal.kind ?? "change" })}</p>
          {expected.length ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {expected.map(([name, count]) => `${name} ${count}`).join(" · ")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {pending
              ? t("expiresAt", {
                  time: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                    new Date(approval.expires_at),
                  ),
                })
              : `${approved ? t("approved") : t("denied")}${approval.decision_note ? `：${approval.decision_note}` : ""}`}
          </p>
        </div>
      </div>
      {pending ? (
        <>
          <Textarea
            rows={2}
            maxLength={2000}
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={decide.isPending || busy}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending || busy}
              onClick={() => decide.mutate("deny")}
            >
              {t("deny")}
            </Button>
            <Button size="sm" disabled={decide.isPending || busy} onClick={() => decide.mutate("approve")}>
              {decide.isPending ? t("submitting") : t("approve")}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("notExecuted")}</p>
          <Button size="sm" variant={approved ? "default" : "outline"} disabled={busy} onClick={() => onExecute(approval.id)}>
            {approved ? t("execute") : t("continueDenied")}
          </Button>
        </div>
      )}
    </div>
  );
}
