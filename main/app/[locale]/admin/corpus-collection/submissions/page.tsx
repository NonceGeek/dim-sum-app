"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bot, Check, Eye, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Submission = {
  id: string;
  title: string;
  intro: string;
  submissionType: string;
  tags: string[];
  reviewStatus: string;
  reviewReason?: string | null;
  isFeatured: boolean;
  showOnHome: boolean;
  visibility: string;
  likeCount: number;
  commentCount: number;
  activity?: { id: string; title: string } | null;
  author?: { id: string; name?: string | null; avatar?: string | null } | null;
  media: Array<{ type: string; url: string; durationSec?: number | null }>;
  createdAt: string;
};

type SubmissionsResponse = {
  items: Submission[];
  pagination: { page: number; pageSize: number; total: number };
};

const reviewStatuses = ["pending_review", "ai_reviewing", "review_needed", "approved", "rejected"];

const statusColor: Record<string, string> = {
  pending_review: "bg-warning text-warning-foreground",
  ai_reviewing: "bg-info text-info-foreground",
  review_needed: "bg-primary text-primary-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

export default function CorpusCollectionSubmissionsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["corpus-collection-submissions", q, reviewStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (q) params.set("q", q);
      if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
      const response = await fetch(`/api/admin/corpus-collection/submissions?${params}`);
      if (!response.ok) throw new Error("Failed to load submissions");
      return response.json();
    },
  });

  const selectedItems = useMemo(
    () => data?.items.filter((item) => selected.includes(item.id)) ?? [],
    [data?.items, selected]
  );

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: unknown }) => {
      const response = await fetch(`/api/admin/corpus-collection/submissions/${id}/${action}`, {
        method: action === "display" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Action failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Submission updated");
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Action failed"),
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/review-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionIds: selected,
          context: {
            theme: "岭南文化语料征集",
            guidelines: "鼓励含荔湾地域文化、粤语表达、岭南生活记忆的内容",
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to create AI review batch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("AI review batch created");
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create batch"),
  });

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const reject = (id: string) => {
    const reason = window.prompt("Reject reason");
    if (!reason) return;
    actionMutation.mutate({ id, action: "reject", body: { reason } });
  };

  const markReviewNeeded = (id: string) => {
    const reason = window.prompt("Review note") || undefined;
    actionMutation.mutate({ id, action: "mark-review-needed", body: { reason } });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Submissions</h2>
        <p className="text-muted-foreground mt-2">
          Review user submissions, manage display, and send batches to AI review.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search title or intro" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={reviewStatus} onValueChange={setReviewStatus}>
              <SelectTrigger className="w-full lg:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {reviewStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={selected.length === 0 || batchMutation.isPending} onClick={() => batchMutation.mutate()}>
              <Bot className="mr-2 h-4 w-4" />
              Send AI Review ({selected.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Submission List ({data?.pagination.total ?? 0})</CardTitle>
          <CardDescription>
            {selectedItems.length > 0 ? `${selectedItems.length} selected for batch review.` : "Select pending items for AI review."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Submission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Display</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(submission.id)}
                        disabled={!["pending_review", "review_needed"].includes(submission.reviewStatus)}
                        onCheckedChange={() => toggleSelected(submission.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{submission.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">{submission.intro}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline">{submission.submissionType}</Badge>
                        {submission.activity && <Badge variant="outline">{submission.activity.title}</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {submission.author?.name || "Unknown"} · {format(new Date(submission.createdAt), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[submission.reviewStatus] ?? "bg-secondary"}>{submission.reviewStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {["image", "audio", "video"].map((type) => (
                          <Badge key={type} variant="outline">
                            {type}: {submission.media.filter((item) => item.type === type).length}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={submission.isFeatured}
                            onCheckedChange={(checked) => actionMutation.mutate({ id: submission.id, action: "display", body: { isFeatured: checked } })}
                          />
                          Featured
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={submission.showOnHome}
                            onCheckedChange={(checked) => actionMutation.mutate({ id: submission.id, action: "display", body: { showOnHome: checked } })}
                          />
                          Home
                        </label>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>Likes: {submission.likeCount}</div>
                      <div>Comments: {submission.commentCount}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="icon" variant="outline" onClick={() => window.open(`/api/admin/corpus-collection/submissions/${submission.id}`, "_blank")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => actionMutation.mutate({ id: submission.id, action: "approve" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => reject(submission.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => markReviewNeeded(submission.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7}>No submissions found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
