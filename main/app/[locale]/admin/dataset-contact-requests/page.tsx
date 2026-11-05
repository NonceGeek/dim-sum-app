"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { json } from "@/components/library-ops/ops-shared";

type ContactRequest = {
  id: string;
  datasetSlug: string;
  datasetName: string;
  requestType: "access_request" | "contact";
  contactName: string;
  contactEmail: string;
  organizationName: string | null;
  message: string;
  status: "OPEN" | "HANDLED";
  handledByName: string | null;
  handledAt: string | null;
  createdAt: string;
};

export default function DatasetContactRequestsPage() {
  const t = useTranslations("LibraryOps");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["dataset-contact-requests", status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      return json<{ items: ContactRequest[]; total: number; pageSize: number }>(
        await fetch(`/api/admin/dataset-contact-requests?${params}`),
      );
    },
  });
  const mark = useMutation({
    mutationFn: async (input: { id: string; status: "OPEN" | "HANDLED" }) =>
      json(
        await fetch("/api/admin/dataset-contact-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
    onSuccess: () => {
      toast.success(t("saved"));
      void queryClient.invalidateQueries({ queryKey: ["dataset-contact-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["library-ops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const fmt = (v: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("contactRequests.title")}</h2>
        <p className="text-muted-foreground">{t("contactRequests.description")}</p>
      </div>
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
        <option value="OPEN">{t("contactRequests.status.OPEN")}</option>
        <option value="HANDLED">{t("contactRequests.status.HANDLED")}</option>
      </select>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("contactRequests.columns.time")}</TableHead>
              <TableHead>{t("contactRequests.columns.dataset")}</TableHead>
              <TableHead>{t("contactRequests.columns.contact")}</TableHead>
              <TableHead>{t("contactRequests.columns.message")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">{t("loading")}</TableCell>
              </TableRow>
            )}
            {list.isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">{(list.error as Error).message}</TableCell>
              </TableRow>
            )}
            {list.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">{t("empty")}</TableCell>
              </TableRow>
            )}
            {list.data?.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{fmt(r.createdAt)}</TableCell>
                <TableCell className="max-w-48">
                  <Link href={`/library/datasets/${encodeURIComponent(r.datasetSlug)}`} target="_blank" className="block truncate text-primary hover:underline">
                    {r.datasetName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{t(`contactRequests.type.${r.requestType}`)}</span>
                </TableCell>
                <TableCell className="max-w-52 text-sm">
                  <b className="block truncate">{r.contactName}</b>
                  <a href={`mailto:${r.contactEmail}`} className="block truncate text-xs text-primary">{r.contactEmail}</a>
                  {r.organizationName && <span className="block truncate text-xs text-muted-foreground">{r.organizationName}</span>}
                </TableCell>
                <TableCell className="max-w-md whitespace-pre-line text-sm">{r.message}</TableCell>
                <TableCell className="text-xs">
                  {t(`contactRequests.status.${r.status}`)}
                  {r.handledByName && <div className="text-muted-foreground">{r.handledByName}</div>}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ id: r.id, status: r.status === "OPEN" ? "HANDLED" : "OPEN" })}
                  >
                    {r.status === "OPEN" ? t("contactRequests.markHandled") : t("contactRequests.reopen")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("prev")}</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("next")}</Button>
        </div>
      )}
    </div>
  );
}
