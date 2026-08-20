"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Award, Bot, Check, Eye, Loader2, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  isAwarded: boolean;
  awardStatus: string;
  activity?: { id: string; displayUuid: string; title: string } | null;
  author?: { id: string; name?: string | null; avatar?: string | null } | null;
  media: Array<{ type: string; url: string; durationSec?: number | null }>;
  createdAt: string;
};

type SubmissionsResponse = {
  items: Submission[];
  pagination: { page: number; pageSize: number; total: number };
};

type Activity = {
  id: string;
  displayUuid: string;
  title: string;
};

type ActivitiesResponse = {
  items: Activity[];
  pagination: { page: number; pageSize: number; total: number };
};

type ActionMutationVariables = { id: string; action: string; body?: unknown };

const reviewStatuses = ["pending_review", "ai_reviewing", "review_needed", "approved", "rejected"];

const statusColor: Record<string, string> = {
  pending_review: "bg-warning text-warning-foreground",
  ai_reviewing: "bg-info text-info-foreground",
  review_needed: "bg-primary text-primary-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

export default function CorpusCollectionSubmissionsPage() {
  const t = useTranslations("SubmissionsAdmin");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const statusLabel = (value: string) => t(`status.${value}`);
  const [q, setQ] = useState("");
  const [qMode, setQMode] = useState("content");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: activitiesData } = useQuery<ActivitiesResponse>({
    queryKey: ["corpus-collection-activities-for-submission-filter"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/activities?pageSize=100");
      if (!response.ok) throw new Error(t("errors.activities"));
      return response.json();
    },
  });

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["corpus-collection-submissions", q, qMode, reviewStatus, activityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (q) params.set("q", q);
      if (q) params.set("qMode", qMode);
      if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
      if (activityFilter === "none") {
        params.set("withoutActivity", "true");
      } else if (activityFilter !== "all") {
        params.set("activityId", activityFilter);
      }
      const response = await fetch(`/api/admin/corpus-collection/submissions?${params}`);
      if (!response.ok) throw new Error(t("errors.submissions"));
      return response.json();
    },
  });

  const selectedItems = useMemo(
    () => data?.items.filter((item) => selected.includes(item.id)) ?? [],
    [data?.items, selected]
  );

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, body }: ActionMutationVariables) => {
      const response = await fetch(`/api/admin/corpus-collection/submissions/${id}/${action}`, {
        method: action === "display" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || t("errors.action"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("messages.updated"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("errors.action")),
  });

  const awardMutation = useMutation({
    mutationFn: async ({ id, isAwarded, awardStatus }: { id: string; isAwarded: boolean; awardStatus: string }) => {
      const response = await fetch(`/api/admin/corpus-collection/submissions/${id}/award`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAwarded, awardStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || t("errors.award"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("messages.awardUpdated"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("errors.award")),
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
        throw new Error(payload.error || t("errors.batch"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("messages.batchCreated"));
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-submissions"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("errors.batch")),
  });

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const reject = (id: string) => {
    const reason = window.prompt(t("prompts.reject"));
    if (!reason) return;
    actionMutation.mutate({ id, action: "reject", body: { reason } });
  };

  const markReviewNeeded = (id: string) => {
    const reason = window.prompt(t("prompts.review")) || undefined;
    actionMutation.mutate({ id, action: "mark-review-needed", body: { reason } });
  };

  const renderActionButton = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    options: { disabled?: boolean; loading?: boolean } = {}
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          onClick={onClick}
          aria-label={label}
          disabled={options.disabled || options.loading}
        >
          {options.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  const isActionPending = (id: string, action: string) =>
    actionMutation.isPending &&
    actionMutation.variables?.id === id &&
    actionMutation.variables?.action === action;

  const isAwardPending = (id: string) =>
    awardMutation.isPending && awardMutation.variables?.id === id;

  const hasPendingRowAction = actionMutation.isPending || awardMutation.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={qMode === "activityUuid" ? t("filters.uuidPlaceholder") : t("filters.contentPlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={qMode} onValueChange={setQMode}>
              <SelectTrigger className="w-full lg:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="content">{t("filters.content")}</SelectItem>
                <SelectItem value="activityUuid">{t("filters.uuid")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reviewStatus} onValueChange={setReviewStatus}>
              <SelectTrigger className="w-full lg:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status.all")}</SelectItem>
                {reviewStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-full lg:w-64"><SelectValue placeholder={t("filters.activity")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allActivities")}</SelectItem>
                <SelectItem value="none">{t("filters.withoutActivity")}</SelectItem>
                {activitiesData?.items.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>{activity.title} · {activity.displayUuid}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={selected.length === 0 || batchMutation.isPending} onClick={() => batchMutation.mutate()}>
              {batchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
              {t("sendReview", { count: selected.length })}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t("list.title", { count: data?.pagination.total ?? 0 })}</CardTitle>
          <CardDescription>
            {selectedItems.length > 0 ? t("list.selected", { count: selectedItems.length }) : t("list.hint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t("columns.submission")}</TableHead>
                <TableHead>{t("columns.activity")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.media")}</TableHead>
                <TableHead>{t("columns.display")}</TableHead>
                <TableHead>{t("columns.stats")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>
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
                        {submission.isAwarded && <Badge className="bg-success text-success-foreground">{submission.awardStatus}</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {submission.author?.name || t("unknown")} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(submission.createdAt))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-48 text-sm text-muted-foreground">
                      {submission.activity ? (
                        <div className="space-y-1">
                          <div className="line-clamp-1 text-foreground">{submission.activity.title}</div>
                          <code className="line-clamp-1 text-xs text-muted-foreground">{submission.activity.displayUuid}</code>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[submission.reviewStatus] ?? "bg-secondary"}>{statusLabel(submission.reviewStatus)}</Badge>
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
                          {t("display.featured")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={submission.showOnHome}
                            onCheckedChange={(checked) => actionMutation.mutate({ id: submission.id, action: "display", body: { showOnHome: checked } })}
                          />
                          {t("display.home")}
                        </label>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{t("stats.likes", { count: submission.likeCount })}</div>
                      <div>{t("stats.comments", { count: submission.commentCount })}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {renderActionButton(
                          t("actions.view"),
                          <Eye className="h-4 w-4" />,
                          () => window.open(`/${locale}/admin/corpus-collection/submissions/${submission.id}`, "_blank")
                        )}
                        {renderActionButton(
                          t("actions.approve"),
                          <Check className="h-4 w-4" />,
                          () => actionMutation.mutate({ id: submission.id, action: "approve" }),
                          {
                            disabled: hasPendingRowAction,
                            loading: isActionPending(submission.id, "approve"),
                          }
                        )}
                        {renderActionButton(
                          t("actions.reject"),
                          <X className="h-4 w-4" />,
                          () => reject(submission.id),
                          {
                            disabled: hasPendingRowAction,
                            loading: isActionPending(submission.id, "reject"),
                          }
                        )}
                        {renderActionButton(
                          t("actions.reviewNeeded"),
                          <Star className="h-4 w-4" />,
                          () => markReviewNeeded(submission.id),
                          {
                            disabled: hasPendingRowAction,
                            loading: isActionPending(submission.id, "mark-review-needed"),
                          }
                        )}
                        {renderActionButton(
                          submission.isAwarded ? t("actions.removeAward") : t("actions.markAwarded"),
                          <Award className="h-4 w-4" />,
                          () =>
                            awardMutation.mutate({
                              id: submission.id,
                              isAwarded: !submission.isAwarded,
                              awardStatus: submission.isAwarded ? "none" : "awarded",
                            }),
                          {
                            disabled: hasPendingRowAction,
                            loading: isAwardPending(submission.id),
                          }
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8}>{t("empty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
