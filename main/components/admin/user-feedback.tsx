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
  source: "wechat_miniprogram";
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
export function UserFeedback() {
  const en = useLocale() === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const label = (key: string) => (labels[key] ? t(...labels[key]) : key);
  const [status, setStatus] = useState("all"),
    [type, setType] = useState("all"),
    [source, setSource] = useState("all"),
    [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Feedback | null>(null),
    [nextStatus, setNextStatus] = useState("OPEN"),
    [note, setNote] = useState("");
  const client = useQueryClient();
  const feedback = useQuery({
    queryKey: ["search-app-feedback", status, type, source, page],
    queryFn: () =>
      fetch(
        `/api/admin/feedback?page=${page}${source !== "all" ? `&source=${source}` : ""}${status !== "all" ? `&status=${status}` : ""}${type !== "all" ? `&type=${type}` : ""}`,
      ).then(json),
  });
  const save = useMutation({
    mutationFn: () =>
      fetch("/api/admin/feedback", {
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
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("用户反馈", "User feedback")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("反馈列表", "Feedback list")}</CardTitle>
          <CardDescription>
            {t(
              "按来源查看和处理用户反馈。目前仅接入微信小程序。匿名反馈不展示用户身份；已登录用户由服务端关联账号。",
              "Review feedback by source. Currently only WeChat mini-programs are connected. Anonymous feedback has no account; signed-in users are linked server-side.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2">
              <Label htmlFor="feedback-source">{t("来源", "Source")}</Label>
              <Select
                value={source}
                onValueChange={(value) => {
                  setSource(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="feedback-source" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("全部来源", "All sources")}
                  </SelectItem>
                  <SelectItem value="wechat_miniprogram">
                    {t("微信小程序", "WeChat mini-program")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                <TableHead>{t("来源", "Source")}</TableHead>
                <TableHead>{t("类型 / 内容", "Type / content")}</TableHead>
                <TableHead>{t("状态", "Status")}</TableHead>
                <TableHead>{t("提交时间", "Submitted")}</TableHead>
                <TableHead>{t("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.data?.items.map((f: Feedback) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap">
                    {f.source === "wechat_miniprogram"
                      ? t("微信小程序", "WeChat mini-program")
                      : t("未知来源", "Unknown source")}
                  </TableCell>
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
            <dt>{t("来源", "Source")}</dt>
            <dd>
              {selected?.source === "wechat_miniprogram"
                ? t("微信小程序", "WeChat mini-program")
                : t("未知来源", "Unknown source")}
            </dd>
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
