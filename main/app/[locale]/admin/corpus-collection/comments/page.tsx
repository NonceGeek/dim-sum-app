"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Search, X } from "lucide-react";
import { useState } from "react";
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
      toast.success("Comment updated");
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-comments"] });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update comment"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Comments</h2>
        <p className="mt-2 text-muted-foreground">Review user comments before they appear publicly.</p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search comments" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Comment Queue ({data?.pagination.total ?? 0})</CardTitle>
          <CardDescription>Approving a comment recalculates the submission comment count.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comment</TableHead>
                <TableHead>Work</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="max-w-xl">
                      <div className="whitespace-pre-wrap text-sm text-foreground">{comment.content}</div>
                    </TableCell>
                    <TableCell>{comment.submission?.title ?? "-"}</TableCell>
                    <TableCell>{comment.author?.name ?? "Unknown"}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[comment.status] ?? "bg-secondary"}>{comment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {comment.createdAt ? format(new Date(comment.createdAt), "MMM d, yyyy HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="outline" onClick={() => actionMutation.mutate({ id: comment.id, action: "approve" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => actionMutation.mutate({ id: comment.id, action: "reject" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>No comments found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
