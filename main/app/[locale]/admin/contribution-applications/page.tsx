"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Mail, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  ApplicationAction,
} from "@/lib/library/application-workflow";
import {
  SelectField,
  StatusBadge,
  UserSelect,
  json,
  useOptionLabel,
} from "@/components/library-ops/ops-shared";

type Application = {
  id: string;
  applicationNo: string;
  contributionKind: string;
  contributorType: string;
  contactName: string;
  contactEmail: string;
  organizationName: string;
  contactRole: string | null;
  region: string | null;
  otherContact: string | null;
  datasetName: string;
  shortDescription: string;
  modalities: string[];
  useCase: string;
  scaleDescription: string;
  sourceCollectionMethod: string;
  rightsStatus: string;
  rightsHolder: string;
  submitterAuthority: string;
  intendedAccessMode: string;
  licenseStatus: string;
  licenseNameOrUrl: string | null;
  privacyStatus: string;
  referenceUrl: string | null;
  applicantNote: string | null;
  status: string;
  currentHandlerId: string | null;
  currentHandlerName: string | null;
  allowResubmit: boolean | null;
  createdAt: string;
};
type HistoryEvent = {
  id: string;
  operationType: string;
  operatorName: string | null;
  operatorRole: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
type Detail = {
  application: Application;
  events: HistoryEvent[];
  lead: { id: string; leadNo: string; status: string; assigneeName: string; priority: string } | null;
  userNames: Record<string, string>;
  availableActions: ApplicationAction[];
};

const INFO_TYPES = ["rights", "source", "license", "privacy", "data_dictionary", "other"];
const REJECT_REASONS = ["rights_unclear", "privacy_risk", "quality", "out_of_scope", "duplicate", "other"];
const CHANNELS = ["email", "phone", "wechat", "meeting", "other"];

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function ActionDialog({
  action,
  application,
  onClose,
  onDone,
}: {
  action: ApplicationAction | null;
  application: Application;
  onClose: () => void;
  onDone: (result: { leadNo?: string }) => void;
}) {
  const t = useTranslations("LibraryOps");
  const [form, setForm] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!action) return;
    setForm(
      action === "accept"
        ? {
            priority: "normal",
            targetIngestionType: "new_dataset",
            proposedDatasetName: application.datasetName,
            rightsMaterialRequired: "pending",
            privacyAssessmentRequired: "pending",
          }
        : action === "contact-logs"
          ? { channel: "email", contactedAt: localNow() }
          : action === "reject"
            ? { allowResubmit: true }
            : action === "request-info"
              ? { infoTypes: [] }
              : {},
    );
  }, [action, application.datasetName]);
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const mutation = useMutation({
    mutationFn: async () => {
      const body =
        action === "contact-logs"
          ? { ...form, contactedAt: new Date(form.contactedAt).toISOString() }
          : form;
      return json<{ leadNo?: string }>(
        await fetch(`/api/admin/contribution-applications/${application.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
    onSuccess: (data) => onDone(data),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!action) return null;
  const opt = (group: string, values: string[]) =>
    values.map((v) => [v, t(`${group}.${v}`)] as [string, string]);
  const noteRequired = ["request-info", "rights-review", "reject", "reopen"].includes(action);
  const yesNo = opt("yesNo", ["yes", "no", "pending"]);

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(`actions.${action}`)}</DialogTitle>
            <DialogDescription>
              {application.applicationNo} · {application.datasetName}
            </DialogDescription>
          </DialogHeader>

          {(action === "assign" || action === "rights-review" || action === "request-info") && (
            <div className="space-y-1.5">
              <Label htmlFor="act-handler">
                {t(action === "rights-review" ? "form.rightsOwner" : "form.handler")}
                {action === "rights-review" && " *"}
              </Label>
              <UserSelect
                id="act-handler"
                capability="contribution_review"
                value={form.handlerId ?? ""}
                onChange={(v) => set("handlerId", v || undefined)}
              />
              {action !== "rights-review" && (
                <p className="text-xs text-muted-foreground">{t("form.handlerHint")}</p>
              )}
            </div>
          )}

          {action === "request-info" && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("form.infoTypes")} *</legend>
              <div className="flex flex-wrap gap-3">
                {INFO_TYPES.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.infoTypes?.includes(v) ?? false}
                      onChange={(e) =>
                        set(
                          "infoTypes",
                          e.target.checked
                            ? [...(form.infoTypes ?? []), v]
                            : (form.infoTypes ?? []).filter((x: string) => x !== v),
                        )
                      }
                    />
                    {t(`infoType.${v}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {action === "contact-logs" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="act-channel">{t("form.channel")} *</Label>
                <SelectField id="act-channel" value={form.channel ?? ""} onChange={(v) => set("channel", v)} options={opt("channel", CHANNELS)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-time">{t("form.contactedAt")} *</Label>
                <Input id="act-time" type="datetime-local" value={form.contactedAt ?? ""} onChange={(e) => set("contactedAt", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="act-result">{t("form.result")} *</Label>
                <Input id="act-result" maxLength={200} value={form.result ?? ""} onChange={(e) => set("result", e.target.value)} placeholder={t("form.resultPlaceholder")} />
              </div>
            </div>
          )}

          {action === "reject" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="act-reason">{t("form.rejectReason")} *</Label>
                <SelectField id="act-reason" value={form.reasonCategory ?? ""} onChange={(v) => set("reasonCategory", v)} options={opt("rejectReason", REJECT_REASONS)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.allowResubmit} onChange={(e) => set("allowResubmit", e.target.checked)} />
                {t("form.allowResubmit")}
              </label>
            </div>
          )}

          {action === "accept" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="act-assignee">{t("form.assignee")} *</Label>
                <UserSelect id="act-assignee" capability="ingestion_assignee" value={form.assigneeId ?? ""} onChange={(v) => set("assigneeId", v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-priority">{t("form.priority")} *</Label>
                <SelectField id="act-priority" value={form.priority ?? ""} onChange={(v) => set("priority", v)} options={opt("priority", ["normal", "high", "urgent"])} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-type">{t("form.targetIngestionType")} *</Label>
                <SelectField id="act-type" value={form.targetIngestionType ?? ""} onChange={(v) => set("targetIngestionType", v)} options={opt("ingestionType", ["new_dataset", "supplement_existing", "to_be_confirmed"])} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="act-name">{t("form.proposedDatasetName")} *</Label>
                <Input id="act-name" maxLength={200} value={form.proposedDatasetName ?? ""} onChange={(e) => set("proposedDatasetName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-rights">{t("form.rightsMaterialRequired")} *</Label>
                <SelectField id="act-rights" value={form.rightsMaterialRequired ?? ""} onChange={(v) => set("rightsMaterialRequired", v)} options={yesNo} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-privacy">{t("form.privacyAssessmentRequired")} *</Label>
                <SelectField id="act-privacy" value={form.privacyAssessmentRequired ?? ""} onChange={(v) => set("privacyAssessmentRequired", v)} options={yesNo} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="act-handover">{t("form.handoverNote")} *</Label>
                <Textarea id="act-handover" rows={4} maxLength={2000} value={form.handoverNote ?? ""} onChange={(e) => set("handoverNote", e.target.value)} />
              </div>
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground sm:col-span-2">
                {t("form.noNotification")}
              </p>
            </div>
          )}

          {action !== "accept" && (
            <div className="space-y-1.5">
              <Label htmlFor="act-note">
                {t("form.note")}
                {noteRequired && " *"}
              </Label>
              <Textarea id="act-note" rows={3} maxLength={2000} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant={action === "reject" ? "destructive" : "default"}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-sm">{children || "—"}</dd>
    </div>
  );
}

function eventSummary(
  e: HistoryEvent,
  t: ReturnType<typeof useTranslations>,
  names: Record<string, string>,
) {
  const p = e.payload ?? {};
  const name = (id: unknown) => (typeof id === "string" ? (names[id] ?? id) : "");
  const parts: string[] = [];
  if (typeof p.handlerId === "string") parts.push(t("history.handler", { name: name(p.handlerId) }));
  if (typeof p.assigneeId === "string") parts.push(t("history.assignee", { name: name(p.assigneeId) }));
  if (typeof p.leadNo === "string") parts.push(String(p.leadNo));
  if (typeof p.channel === "string") parts.push(t(`channel.${p.channel}`));
  if (typeof p.result === "string") parts.push(p.result);
  if (Array.isArray(p.infoTypes)) parts.push(p.infoTypes.map((v) => t(`infoType.${v}`)).join("、"));
  if (typeof p.reasonCategory === "string") parts.push(t(`rejectReason.${p.reasonCategory}`));
  return parts.join(" · ");
}

function DetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("LibraryOps");
  const label = useOptionLabel();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ApplicationAction | null>(null);
  const detail = useQuery({
    queryKey: ["contribution-application", id],
    enabled: !!id,
    queryFn: async () => json<Detail>(await fetch(`/api/admin/contribution-applications/${id}`)),
  });
  const a = detail.data?.application;
  const fmt = (v: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
  const contactText = a
    ? [
        `${t("fields.contactName")}: ${a.contactName}`,
        `${t("fields.organization")}: ${a.organizationName}`,
        `${t("fields.email")}: ${a.contactEmail}`,
        a.otherContact && `${t("fields.otherContact")}: ${a.otherContact}`,
        a.region && `${t("fields.region")}: ${a.region}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t("detailTitle", { no: a?.applicationNo ?? "" })}</SheetTitle>
          <SheetDescription>{a ? `${a.datasetName}` : t("loading")}</SheetDescription>
        </SheetHeader>
        {detail.isError && <p className="p-6 text-destructive">{(detail.error as Error).message}</p>}
        {a && detail.data && (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={a.status} />
                <span className="text-sm text-muted-foreground">
                  {t("fields.handler")}: {a.currentHandlerName ?? "—"}
                </span>
                {detail.data.lead && (
                  <Badge variant="outline">
                    {t("leadBadge", { no: detail.data.lead.leadNo, name: detail.data.lead.assigneeName })}
                  </Badge>
                )}
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t("sections.contact")}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(contactText)}>
                      <Copy /> {t("copyContact")}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${a.contactEmail}?subject=${encodeURIComponent(`[DimSum AI] ${a.applicationNo}`)}`}>
                        <Mail /> {t("sendEmail")}
                      </a>
                    </Button>
                  </div>
                </div>
                <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <Info label={t("fields.contactName")}>{a.contactName}{a.contactRole ? ` · ${a.contactRole}` : ""}</Info>
                  <Info label={t("fields.organization")}>{a.organizationName}</Info>
                  <Info label={t("fields.email")}>
                    <button type="button" className="text-primary hover:underline" onClick={() => copy(a.contactEmail)}>
                      {a.contactEmail}
                    </button>
                  </Info>
                  <Info label={t("fields.otherContact")}>{a.otherContact}</Info>
                  <Info label={t("fields.region")}>{a.region}</Info>
                  <Info label={t("fields.submittedAt")}>{fmt(a.createdAt)}</Info>
                  <Info label={t("fields.contributorType")}>{label("contributorType", a.contributorType)}</Info>
                  <Info label={t("fields.contributionKind")}>{t(`kind.${a.contributionKind}`)}</Info>
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="font-medium">{t("sections.dataset")}</h3>
                <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <Info label={t("fields.datasetName")} full>{a.datasetName}</Info>
                  <Info label={t("fields.shortDescription")} full>{a.shortDescription}</Info>
                  <Info label={t("fields.modalities")}>{a.modalities.map((m) => label("modality", m)).join(" / ")}</Info>
                  <Info label={t("fields.useCase")}>{label("useCase", a.useCase)}</Info>
                  <Info label={t("fields.scale")}>{a.scaleDescription}</Info>
                  <Info label={t("fields.referenceUrl")}>
                    {a.referenceUrl && /^https?:\/\//i.test(a.referenceUrl) ? (
                      <a href={a.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {a.referenceUrl}
                      </a>
                    ) : (
                      a.referenceUrl
                    )}
                  </Info>
                  <Info label={t("fields.source")} full>{a.sourceCollectionMethod}</Info>
                  <Info label={t("fields.applicantNote")} full>{a.applicantNote}</Info>
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="font-medium">{t("sections.rights")}</h3>
                <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <Info label={t("fields.rightsStatus")}>{label("rightsStatus", a.rightsStatus)}</Info>
                  <Info label={t("fields.rightsHolder")}>{a.rightsHolder}</Info>
                  <Info label={t("fields.submitterAuthority")}>{label("submitterAuthority", a.submitterAuthority)}</Info>
                  <Info label={t("fields.licenseStatus")}>
                    {label("licenseStatus", a.licenseStatus)}
                    {a.licenseNameOrUrl ? ` · ${a.licenseNameOrUrl}` : ""}
                  </Info>
                  <Info label={t("fields.privacyStatus")}>{label("privacyStatus", a.privacyStatus)}</Info>
                  <Info label={t("fields.intendedAccessMode")}>{label("intendedAccessMode", a.intendedAccessMode)}</Info>
                </dl>
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                  {t("reviewHint")}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="font-medium">{t("sections.history")}</h3>
                <ol className="space-y-3 border-l pl-4">
                  {detail.data.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm">
                        <b>{t(`event.${e.operationType}`)}</b>
                        {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {t(`status.${e.fromStatus}`)} → {t(`status.${e.toStatus}`)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(e.createdAt)} · {e.operatorName ?? t("applicant")}
                        {eventSummary(e, t, detail.data!.userNames) &&
                          ` · ${eventSummary(e, t, detail.data!.userNames)}`}
                      </p>
                      {e.note && <p className="mt-1 whitespace-pre-line text-sm">{e.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              {detail.data.availableActions.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("finished")}</p>
              )}
              {detail.data.availableActions.map((act) => (
                <Button
                  key={act}
                  size="sm"
                  variant={act === "accept" ? "default" : act === "reject" ? "destructive" : "outline"}
                  onClick={() => setAction(act)}
                >
                  {t(`actions.${act}`)}
                </Button>
              ))}
            </div>
            <ActionDialog
              action={action}
              application={a}
              onClose={() => setAction(null)}
              onDone={(result) => {
                setAction(null);
                toast.success(result.leadNo ? t("leadCreated", { no: result.leadNo }) : t("saved"));
                void queryClient.invalidateQueries({ queryKey: ["contribution-application", id] });
                void queryClient.invalidateQueries({ queryKey: ["contribution-applications"] });
                void queryClient.invalidateQueries({ queryKey: ["library-ops"] });
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ContributionApplicationsPage() {
  const t = useTranslations("LibraryOps");
  const label = useOptionLabel();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["contribution-applications", q, status, mine, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (mine) params.set("mine", "1");
      return json<{
        items: Application[];
        total: number;
        pageSize: number;
        stats: { byStatus: Record<string, number>; acceptedThisMonth: number };
      }>(await fetch(`/api/admin/contribution-applications?${params}`));
    },
  });
  const stats = list.data?.stats;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const cards = [
    ["PENDING_INITIAL_REVIEW", stats?.byStatus.PENDING_INITIAL_REVIEW ?? 0],
    ["RIGHTS_PRIVACY_REVIEW", stats?.byStatus.RIGHTS_PRIVACY_REVIEW ?? 0],
    ["PENDING_APPLICANT_INFO", stats?.byStatus.PENDING_APPLICANT_INFO ?? 0],
    ["acceptedThisMonth", stats?.acceptedThisMonth ?? 0],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {key === "acceptedThisMonth" ? t("acceptedThisMonth") : t(`status.${key}`)}
              </p>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(search.trim());
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            maxLength={100}
          />
          <Button type="submit" variant="outline" aria-label={t("search")}>
            <Search />
          </Button>
        </form>
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
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setPage(1);
              setMine(e.target.checked);
            }}
          />
          {t("onlyMine")}
        </label>
        <Button variant="outline" size="sm" onClick={() => list.refetch()}>
          <RefreshCw /> {t("refresh")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.application")}</TableHead>
              <TableHead>{t("columns.dataset")}</TableHead>
              <TableHead>{t("columns.applicant")}</TableHead>
              <TableHead>{t("columns.rights")}</TableHead>
              <TableHead>{t("columns.access")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.handler")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t("loading")}
                </TableCell>
              </TableRow>
            )}
            {list.isError && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-destructive">
                  {(list.error as Error).message}
                </TableCell>
              </TableRow>
            )}
            {list.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {list.data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <b className="font-mono text-xs">{a.applicationNo}</b>
                  <div className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(a.createdAt))}
                  </div>
                </TableCell>
                <TableCell className="max-w-56">
                  <b className="block truncate">{a.datasetName}</b>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.modalities.map((m) => label("modality", m)).join(" / ")} · {a.scaleDescription}
                  </div>
                </TableCell>
                <TableCell className="max-w-52">
                  <b className="block truncate">{a.contactName}</b>
                  <div className="truncate text-xs text-muted-foreground">{a.organizationName}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.contactEmail}</div>
                </TableCell>
                <TableCell className="max-w-48 text-xs">
                  <div className="truncate">{label("rightsStatus", a.rightsStatus)}</div>
                  <div className="truncate text-muted-foreground">{label("privacyStatus", a.privacyStatus)}</div>
                </TableCell>
                <TableCell className="text-xs">{label("intendedAccessMode", a.intendedAccessMode)}</TableCell>
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>
                <TableCell className="text-sm">{a.currentHandlerName ?? "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>
                    {t("review")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("total", { count: list.data?.total ?? 0 })}</span>
        <div className="flex items-center gap-2">
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
      </div>
      <DetailSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
