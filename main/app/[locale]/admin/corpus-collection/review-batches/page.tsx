"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Batch = {
  id: string;
  batchExternalId: string;
  agentBatchId?: string | null;
  status: string;
  submissionCount: number;
  progress: Record<string, number>;
  createdAt: string;
};

type BatchDetail = Batch & {
  items: Array<{
    id: string;
    submissionId: string;
    submissionExternalId: string;
    status: string;
    result: unknown;
  }>;
};

const statusColor: Record<string, string> = {
  queued: "bg-secondary text-secondary-foreground",
  running: "bg-info text-info-foreground",
  completed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
  cancelled: "bg-warning text-warning-foreground",
};

export default function CorpusCollectionReviewBatchesPage() {
  const t = useTranslations("ReviewBatches");
  const locale = useLocale();
  const statusLabel = (value: string) => ({ queued: t("status.queued"), running: t("status.running"), completed: t("status.completed"), failed: t("status.failed"), cancelled: t("status.cancelled") }[value] || value);
  const [status, setStatus] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: Batch[] }>({
    queryKey: ["corpus-collection-review-batches", status],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/corpus-collection/review-batches?${params}`);
      if (!response.ok) throw new Error(t("errors.load"));
      return response.json();
    },
  });

  const { data: detail } = useQuery<BatchDetail>({
    queryKey: ["corpus-collection-review-batch", selectedBatchId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/review-batches/${selectedBatchId}`);
      if (!response.ok) throw new Error(t("errors.loadDetail"));
      return response.json();
    },
    enabled: Boolean(selectedBatchId),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{t("list.title")}</CardTitle>
              <CardDescription>{t("list.description")}</CardDescription>
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status.all")}</SelectItem>
                <SelectItem value="queued">{t("status.queued")}</SelectItem>
                <SelectItem value="running">{t("status.running")}</SelectItem>
                <SelectItem value="completed">{t("status.completed")}</SelectItem>
                <SelectItem value="failed">{t("status.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.batch")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.count")}</TableHead>
                <TableHead>{t("columns.progress")}</TableHead>
                <TableHead>{t("columns.created")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="font-medium">{batch.batchExternalId}</div>
                      <div className="text-xs text-muted-foreground">{batch.agentBatchId || t("noAgentId")}</div>
                    </TableCell>
                    <TableCell><Badge className={statusColor[batch.status] ?? "bg-secondary"}>{statusLabel(batch.status)}</Badge></TableCell>
                    <TableCell>{batch.submissionCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Object.entries(batch.progress ?? {}).length
                        ? Object.entries(batch.progress).map(([key, value]) => `${key}: ${value}`).join(" · ")
                        : "-"}
                    </TableCell>
                    <TableCell>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.createdAt))}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedBatchId(batch.id)}>{t("inspect")}</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>{t("empty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detail && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("detail.title")}</CardTitle>
            <CardDescription>{detail.batchExternalId}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.submission")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.submissionExternalId}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel(item.status)}</Badge></TableCell>
                    <TableCell className="max-w-xl truncate text-sm text-muted-foreground">
                      {item.result ? JSON.stringify(item.result) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
