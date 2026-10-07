"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEAD_STATUSES, LeadAction } from "@/lib/library/application-workflow";
import { UserSelect, json, useOptionLabel } from "@/components/library-ops/ops-shared";

type Lead = {
  id: string;
  leadNo: string;
  status: string;
  priority: string;
  targetIngestionType: string;
  proposedDatasetName: string;
  handoverNote: string;
  rightsMaterialRequired: string;
  privacyAssessmentRequired: string;
  rightsPrivacySummary: Record<string, string | null>;
  closingNote: string | null;
  ingestionTaskId: string | null;
  assigneeId: string;
  assigneeName: string;
  createdByName: string;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  application: {
    id: string;
    applicationNo: string;
    datasetName: string;
    contactName: string;
    contactEmail: string;
    organizationName: string;
    otherContact: string | null;
    region: string | null;
    scaleDescription: string;
    modalities: string[];
  };
};

const PRIORITY_TONE: Record<string, string> = {
  urgent: "border-transparent bg-destructive text-white",
  high: "border-transparent bg-warning text-warning-foreground",
  normal: "",
};

function LeadActionDialog({
  lead,
  action,
  onClose,
}: {
  lead: Lead;
  action: LeadAction;
  onClose: () => void;
}) {
  const t = useTranslations("LibraryOps");
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const mutation = useMutation({
    mutationFn: async () =>
      json(
        await fetch(`/api/admin/ingestion-leads/${lead.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || undefined, assigneeId: assigneeId || undefined }),
        }),
      ),
    onSuccess: () => {
      toast.success(t("saved"));
      void queryClient.invalidateQueries({ queryKey: ["ingestion-leads"] });
      void queryClient.invalidateQueries({ queryKey: ["library-ops"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(`leads.actions.${action}`)}</DialogTitle>
            <DialogDescription>
              {lead.leadNo} · {lead.proposedDatasetName}
            </DialogDescription>
          </DialogHeader>
          {action === "reassign" && (
            <div className="space-y-1.5">
              <Label htmlFor="lead-assignee">{t("form.assignee")} *</Label>
              <UserSelect id="lead-assignee" capability="ingestion_assignee" value={assigneeId} onChange={setAssigneeId} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="lead-note">
              {t(action === "close" ? "leads.closingNote" : "form.note")}
              {action === "close" && " *"}
            </Label>
            <Textarea id="lead-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function IngestionLeadsPage() {
  const t = useTranslations("LibraryOps");
  const label = useOptionLabel();
  const locale = useLocale();
  const { data: session } = useSession();
  const [scope, setScope] = useState<"me" | "all">("me");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ lead: Lead; action: LeadAction } | null>(null);
  const list = useQuery({
    queryKey: ["ingestion-leads", scope, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ assignee: scope, page: String(page) });
      if (status) params.set("status", status);
      return json<{ items: Lead[]; total: number; pageSize: number; canViewAll: boolean }>(
        await fetch(`/api/admin/ingestion-leads?${params}`),
      );
    },
  });
  const fmt = (v: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("leads.title")}</h2>
        <p className="text-muted-foreground">{t("leads.description")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {list.data?.canViewAll && (
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
                {t(`leads.scope.${s}`)}
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
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`leads.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {list.isLoading && <p className="text-muted-foreground">{t("loading")}</p>}
      {list.isError && <p className="text-destructive">{(list.error as Error).message}</p>}
      {list.data?.items.length === 0 && (
        <p className="rounded-lg border p-8 text-center text-muted-foreground">{t("leads.empty")}</p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {list.data?.items.map((lead) => {
          const summary = lead.rightsPrivacySummary ?? {};
          const isMine = lead.assigneeId === session?.user?.id;
          return (
            <Card key={lead.id}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">{lead.leadNo}</Badge>
                  <Badge variant="secondary">{t(`leads.status.${lead.status}`)}</Badge>
                  <Badge className={PRIORITY_TONE[lead.priority]} variant={lead.priority === "normal" ? "outline" : "default"}>
                    {t(`priority.${lead.priority}`)}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{lead.proposedDatasetName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t(`ingestionType.${lead.targetIngestionType}`)} · {t("leads.from", { no: lead.application.applicationNo })} ·{" "}
                  {lead.application.datasetName}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("fields.contactName")}</dt>
                    <dd>
                      {lead.application.contactName} · {lead.application.organizationName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("fields.email")}</dt>
                    <dd className="break-all">{lead.application.contactEmail}</dd>
                  </div>
                  {lead.application.otherContact && (
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("fields.otherContact")}</dt>
                      <dd>{lead.application.otherContact}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("fields.scale")}</dt>
                    <dd>{lead.application.scaleDescription}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("fields.rightsStatus")}</dt>
                    <dd>{label("rightsStatus", summary.rightsStatus)} · {summary.rightsHolder ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("fields.privacyStatus")}</dt>
                    <dd>{label("privacyStatus", summary.privacyStatus)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("form.rightsMaterialRequired")}</dt>
                    <dd>{t(`yesNo.${lead.rightsMaterialRequired}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("form.privacyAssessmentRequired")}</dt>
                    <dd>{t(`yesNo.${lead.privacyAssessmentRequired}`)}</dd>
                  </div>
                </dl>
                <div className="rounded-md bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{t("form.handoverNote")}</p>
                  <p className="whitespace-pre-line">{lead.handoverNote}</p>
                </div>
                {lead.closingNote && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{t("leads.closingNote")}</p>
                    <p className="whitespace-pre-line">{lead.closingNote}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("leads.meta", {
                    assignee: lead.assigneeName,
                    creator: lead.createdByName,
                    time: fmt(lead.createdAt),
                  })}
                  {lead.acceptedAt && ` · ${t("leads.takenAt", { time: fmt(lead.acceptedAt) })}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isMine && lead.status === "PENDING_OWNER_ACCEPTANCE" && (
                    <Button size="sm" onClick={() => setPending({ lead, action: "take" })}>
                      {t("leads.actions.take")}
                    </Button>
                  )}
                  {isMine && lead.status !== "CLOSED" && (
                    <Button size="sm" variant="outline" onClick={() => setPending({ lead, action: "close" })}>
                      {t("leads.actions.close")}
                    </Button>
                  )}
                  {list.data?.canViewAll && lead.status !== "CLOSED" && (
                    <Button size="sm" variant="outline" onClick={() => setPending({ lead, action: "reassign" })}>
                      {t("leads.actions.reassign")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
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
      {pending && (
        <LeadActionDialog lead={pending.lead} action={pending.action} onClose={() => setPending(null)} />
      )}
    </div>
  );
}
