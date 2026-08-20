"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CommentItem = {
  id: string;
  content: string;
  status: string;
  submission?: { id: string; title: string } | null;
  author?: { id: string; name?: string | null; avatar?: string | null } | null;
  createdAt: string;
};

type CommentsResponse = {
  items: CommentItem[];
  pagination: { page: number; pageSize: number; total: number };
};

const statusColor: Record<string, string> = {
  pending_review: "bg-warning text-warning-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

export default function CorpusCollectionCommentsPage() {
  const t = useTranslations("CorpusCollectionComments");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pending_review");

  const { data, isLoading } = useQuery<CommentsResponse>({
    queryKey: ["corpus-collection-comments", q, status],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/corpus-collection/comments?${params}`);
      if (!response.ok) throw new Error("Failed to load comments");
      return response.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const response = await fetch(`/api/admin/corpus-collection/comments/${id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update comment");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("updated"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-comments"] });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: () => toast.error(t("updateFailed")),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("statuses.all")}</SelectItem>
              <SelectItem value="pending_review">{t("statuses.pending")}</SelectItem>
              <SelectItem value="approved">{t("statuses.approved")}</SelectItem>
              <SelectItem value="rejected">{t("statuses.rejected")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>{t("queue", { count: data?.pagination.total ?? 0 })}</CardTitle>
          <CardDescription>{t("queueDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.comment")}</TableHead>
                <TableHead>{t("columns.work")}</TableHead>
                <TableHead>{t("columns.author")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.created")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="max-w-xl">
                      <div className="whitespace-pre-wrap text-sm text-foreground">{comment.content}</div>
                    </TableCell>
                    <TableCell>{comment.submission?.title ?? "-"}</TableCell>
                    <TableCell>{comment.author?.name ?? t("unknown")}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[comment.status] ?? "bg-secondary"}>{comment.status === "pending_review" ? t("statuses.pending") : comment.status === "approved" ? t("statuses.approved") : comment.status === "rejected" ? t("statuses.rejected") : comment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleString(locale) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="outline" aria-label={t("approve")} onClick={() => actionMutation.mutate({ id: comment.id, action: "approve" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" aria-label={t("reject")} onClick={() => actionMutation.mutate({ id: comment.id, action: "reject" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
    </div>
  );
}
