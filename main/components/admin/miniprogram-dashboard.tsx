"use client";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
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
export function MiniprogramDashboard({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const en = useLocale() === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const range = { from, to };
  const rangeDays = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const validRange =
    Number.isFinite(rangeDays) && rangeDays >= 1 && rangeDays <= 31;
  const analytics = useQuery({
    queryKey: ["search-app-analytics", range],
    enabled: validRange,
    queryFn: () =>
      fetch(
        `/api/admin/search/analytics?from=${range.from}&to=${range.to}`,
      ).then(json),
  });
  const metrics = analytics.data?.data;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          {t("Search 微信小程序", "Search WeChat mini-program")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "当前展示 Search 微信小程序的使用数据。",
            "Usage data for the Search WeChat mini-program.",
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
          {!validRange && (
            <p role="alert" className="text-destructive">
              {t(
                "微信小程序统计最多支持 31 天，请调整上方日期范围。",
                "Mini-program statistics support up to 31 days. Adjust the date range above.",
              )}
            </p>
          )}
          {validRange && analytics.isLoading && (
            <p>{t("加载中…", "Loading…")}</p>
          )}
          {analytics.error && (
            <p role="alert" className="text-destructive">
              {analytics.error.message}
            </p>
          )}
          {validRange && metrics && (
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
    </div>
  );
}
