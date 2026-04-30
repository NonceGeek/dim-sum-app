"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
  const [status, setStatus] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: Batch[] }>({
    queryKey: ["corpus-collection-review-batches", status],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/corpus-collection/review-batches?${params}`);
      if (!response.ok) throw new Error("Failed to load batches");
      return response.json();
    },
  });

  const { data: detail } = useQuery<BatchDetail>({
    queryKey: ["corpus-collection-review-batch", selectedBatchId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/review-batches/${selectedBatchId}`);
      if (!response.ok) throw new Error("Failed to load batch");
      return response.json();
    },
    enabled: Boolean(selectedBatchId),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">AI Review Batches</h2>
        <p className="text-muted-foreground mt-2">Track asynchronous AI review jobs and webhook results.</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Batch List</CardTitle>
              <CardDescription>Created from selected pending submissions.</CardDescription>
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="font-medium">{batch.batchExternalId}</div>
                      <div className="text-xs text-muted-foreground">{batch.agentBatchId || "No agent id yet"}</div>
                    </TableCell>
                    <TableCell><Badge className={statusColor[batch.status] ?? "bg-secondary"}>{batch.status}</Badge></TableCell>
                    <TableCell>{batch.submissionCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Object.entries(batch.progress ?? {}).length
                        ? Object.entries(batch.progress).map(([key, value]) => `${key}: ${value}`).join(" · ")
                        : "-"}
                    </TableCell>
                    <TableCell>{format(new Date(batch.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedBatchId(batch.id)}>Inspect</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>No batches found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detail && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Batch Detail</CardTitle>
            <CardDescription>{detail.batchExternalId}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.submissionExternalId}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
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
