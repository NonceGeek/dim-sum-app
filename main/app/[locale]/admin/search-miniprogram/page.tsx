"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  feedbackStatuses,
  feedbackTypes,
} from "@/lib/search-miniprogram/ui-options";
type Feedback = {
  id: string;
  type: string;
  description: string;
  entryId: string | null;
  userId: string | null;
  status: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  handledBy: string | null;
  handledAt: string | null;
};
async function json(r: Response) {
  const p = await r.json();
  if (!r.ok)
    throw new Error(
      typeof p.error === "string"
        ? p.error
        : (p.error?.message ?? "Request failed"),
    );
  return p;
}
const day = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(Date.now() + offset * 86400000),
  );
const labels: Record<string, [string, string]> = {
  OPEN: ["待处理", "Open"],
  IN_PROGRESS: ["处理中", "In progress"],
  RESOLVED: ["已解决", "Resolved"],
  DISMISSED: ["不予处理", "Dismissed"],
  content_error: ["内容有误", "Content error"],
  audio_issue: ["音频问题", "Audio issue"],
  suggestion: ["功能建议", "Suggestion"],
  other: ["其他", "Other"],
};
export default function SearchMiniprogramPage() {
  const en = useLocale() === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const label = (key: string) => (labels[key] ? t(...labels[key]) : key);
  const [status, setStatus] = useState("all"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1);
  const [from, setFrom] = useState(day(-6)),
    [to, setTo] = useState(day()),
    [range, setRange] = useState({ from: day(-6), to: day() });
  const [selected, setSelected] = useState<Feedback | null>(null),
    [nextStatus, setNextStatus] = useState("OPEN"),
    [note, setNote] = useState("");
  const client = useQueryClient();
  const feedback = useQuery({
    queryKey: ["search-app-feedback", status, type, page],
    queryFn: () =>
      fetch(
        `/api/admin/search/feedback?page=${page}${status !== "all" ? `&status=${status}` : ""}${type !== "all" ? `&type=${type}` : ""}`,
      ).then(json),
  });
  const analytics = useQuery({
    queryKey: ["search-app-analytics", range],
    queryFn: () =>
      fetch(
        `/api/admin/search/analytics?from=${range.from}&to=${range.to}`,
      ).then(json),
  });
  const save = useMutation({
    mutationFn: () =>
      fetch("/api/admin/search/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected?.id,
          status: nextStatus,
          note,
          updatedAt: selected?.updatedAt,
        }),
      }).then(json),
    onSuccess: () => {
      setSelected(null);
      client.invalidateQueries({ queryKey: ["search-app-feedback"] });
      toast.success(t("处理结果已保存", "Feedback updated"));
    },
    onError: (e: Error) => {
      toast.error(e.message);
      client.invalidateQueries({ queryKey: ["search-app-feedback"] });
    },
  });
  const metrics = analytics.data?.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("Search 小程序", "Search mini-program")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "平台管理员可查看小程序使用情况并处理用户反馈。",
            "Platform administrators can review usage and manage feedback.",
          )}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("使用概况", "Usage")}</CardTitle>
          <CardDescription>
            {t(
              "北京时间，单次最多查看 31 天。搜索指标按首次请求统计，翻页不重复计数；失败请求不计入无结果率。",
              "Beijing time, up to 31 days. Search metrics exclude pagination; failed requests are excluded from empty-result rates.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setRange({ from, to });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="search-from">{t("开始日期", "From")}</Label>
              <Input
                id="search-from"
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-to">{t("结束日期", "To")}</Label>
              <Input
                id="search-to"
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button variant="outline">{t("查询", "Apply")}</Button>
          </form>
          {analytics.isLoading && <p>{t("加载中…", "Loading…")}</p>}
          {analytics.error && (
            <p role="alert" className="text-destructive">
              {analytics.error.message}
            </p>
          )}
          {metrics && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  [
                    "searches",
                    t("查询请求", "Search requests"),
                    metrics.requests,
                  ],
                  [
                    "empty",
                    t("无结果率", "Empty-result rate"),
                    metrics.emptyRate === null
                      ? "—"
                      : `${(metrics.emptyRate * 100).toFixed(1)}%`,
                  ],
                  [
                    "direct",
                    t("直接匹配率", "Direct-match rate"),
                    metrics.directRate === null
                      ? "—"
                      : `${(metrics.directRate * 100).toFixed(1)}%`,
                  ],
                  ["errors", t("查询失败", "Search errors"), metrics.errors],
                  ["visitors", t("访问人数", "Visitors"), metrics.visitors],
                  [
                    "clicks",
                    t("结果点击", "Result clicks"),
                    metrics.result_clicks,
                  ],
                  [
                    "audio",
                    t("音频播放 / 失败", "Audio plays / errors"),
                    `${metrics.audio_plays} / ${metrics.audio_errors}`,
                  ],
                  [
                    "share",
                    t("分享触发", "Share triggers"),
                    metrics.share_triggers,
                  ],
                  [
                    "feedback",
                    t(
                      "收到反馈 / 提交失败",
                      "Feedback received / submit errors",
                    ),
                    `${metrics.feedbacks} / ${metrics.feedback_errors}`,
                  ],
                ] as const
              ).map(([key, title, value]) => (
                <div key={key} className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("用户反馈", "Feedback")}</CardTitle>
          <CardDescription>
            {t(
              "匿名反馈不展示用户身份；已登录用户由服务端关联账号。",
              "Anonymous feedback has no account; signed-in users are linked server-side.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2">
              <Label htmlFor="feedback-status">{t("状态", "Status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="feedback-status" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("全部状态", "All statuses")}
                  </SelectItem>
                  {feedbackStatuses.map((v) => (
                    <SelectItem key={v} value={v}>
                      {label(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-type">{t("类型", "Type")}</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="feedback-type" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("全部类型", "All types")}
                  </SelectItem>
                  {feedbackTypes.map((v) => (
                    <SelectItem key={v} value={v}>
                      {label(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="self-end"
              variant="outline"
              onClick={() =>
                client.invalidateQueries({ queryKey: ["search-app-feedback"] })
              }
            >
              {t("刷新", "Refresh")}
            </Button>
          </div>
          {feedback.isLoading && <p>{t("加载中…", "Loading…")}</p>}
          {feedback.error && (
            <p role="alert" className="text-destructive">
              {feedback.error.message}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("类型 / 内容", "Type / content")}</TableHead>
                <TableHead>{t("状态", "Status")}</TableHead>
                <TableHead>{t("提交时间", "Submitted")}</TableHead>
                <TableHead>{t("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.data?.items.map((f: Feedback) => (
                <TableRow key={f.id}>
                  <TableCell className="max-w-sm">
                    <p className="font-medium">{label(f.type)}</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-all text-muted-foreground">
                      {f.description}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{label(f.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(f.createdAt).toLocaleString(en ? "en" : "zh-CN", {
                      timeZone: "Asia/Shanghai",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(f);
                        setNextStatus(f.status);
                        setNote(f.note);
                      }}
                    >
                      {t("查看并处理", "Review")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {feedback.data?.total === 0 && (
            <p className="py-6 text-center text-muted-foreground">
              {t("暂无反馈", "No feedback")}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t("上一页", "Previous")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t(
                `第 ${page} 页，共 ${feedback.data?.total ?? 0} 条`,
                `Page ${page}, ${feedback.data?.total ?? 0} records`,
              )}
            </p>
            <Button
              variant="outline"
              disabled={!feedback.data || page * 20 >= feedback.data.total}
              onClick={() => setPage(page + 1)}
            >
              {t("下一页", "Next")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("处理反馈", "Review feedback")}</DialogTitle>
            <DialogDescription>
              {selected ? label(selected.type) : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-all">
            {selected?.description}
          </p>
          <dl className="space-y-2 break-all text-sm text-muted-foreground">
            <dt>{t("用户", "User")}</dt>
            <dd>{selected?.userId ?? t("匿名", "Anonymous")}</dd>
            <dt>{t("关联内容 ID", "Entry ID")}</dt>
            <dd>{selected?.entryId ?? "—"}</dd>
            <dt>{t("最近处理人", "Last handled by")}</dt>
            <dd>{selected?.handledBy ?? "—"}</dd>
          </dl>
          <div className="space-y-2">
            <Label htmlFor="review-status">{t("处理状态", "Status")}</Label>
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger id="review-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {feedbackStatuses.map((v) => (
                  <SelectItem key={v} value={v}>
                    {label(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-note">
              {t("内部处理备注", "Internal note")}
            </Label>
            <Textarea
              id="feedback-note"
              rows={4}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => setSelected(null)}
            >
              {t("取消", "Cancel")}
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {t("保存", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
