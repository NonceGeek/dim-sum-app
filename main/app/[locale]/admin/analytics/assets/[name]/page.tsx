"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchAssets, useAssetFormat } from "@/components/admin/corpus-assets/asset-ui";
import { formatBytes } from "@/lib/analytics/corpus-assets-format";
import type { AssetDatasetDetail, AssetMediaType } from "@/lib/analytics/corpus-assets";

const PRESETS = [30, 90, 365] as const;

function shanghaiDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

function TrendChart({
  data,
  dataKey,
  label,
  format,
}: {
  data: AssetDatasetDetail["trend"];
  dataKey: "entries" | "avMinutes";
  label: string;
  format: (v: number) => string;
}) {
  const config = { [dataKey]: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data.map((d) => ({ ...d, avMinutes: d.avSeconds / 60 }))} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => format(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium tabular-nums">
                  {label}：{format(Number(value))}
                </span>
              )}
            />
          }
        />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={2} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export default function CorpusAssetDetailPage() {
  const t = useTranslations("CorpusAssets");
  const tAttr = useTranslations("AdminCategories.dataset");
  const f = useAssetFormat();
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName);
  const [days, setDays] = useState<(typeof PRESETS)[number]>(30);
  const range = { from: shanghaiDay(-(days - 1)), to: shanghaiDay() };
  const q = useQuery({
    queryKey: ["corpus-assets", "detail", name, range.from, range.to],
    queryFn: () =>
      fetchAssets<AssetDatasetDetail>(
        `?name=${encodeURIComponent(name)}&from=${range.from}&to=${range.to}`,
      ),
  });
  const detail = q.data;
  const d = detail?.dataset;
  const attr = (v: string) => (["oral", "cultural_knowledge", "unclassified"].includes(v) ? tAttr(v) : v);

  const resources = d ? d.media.audio.count + d.media.video.count + d.media.image.count + d.media.model3d.count : 0;
  const knownTotal = d ? d.size.value : 0;
  const capacityRows: Array<[string, AssetMediaType | "text"]> = [
    [t("capacity.text"), "text"],
    [t("media.audio"), "audio"],
    [t("media.video"), "video"],
    [t("media.image"), "image"],
    [t("capacity.other"), "model3d"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link href="/admin/analytics?tab=assets" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("back")}
          </Link>
          <h2 className="text-2xl font-bold">{d?.nickname || name}</h2>
          {d && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {d.name} · #{d.id}
              </span>
              <Badge variant={d.isPublic ? "secondary" : "outline"}>{d.isPublic ? t("public") : t("private")}</Badge>
              <span>{attr(d.contentAttribute)}</span>
            </div>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/categories?search=${encodeURIComponent(name)}`}>
            <ExternalLink className="mr-1 h-4 w-4" />
            {t("manage")}
          </Link>
        </Button>
      </div>

      {q.isLoading && <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>}
      {q.error && <p className="py-10 text-center text-destructive">{(q.error as Error).message}</p>}

      {d && detail && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("detail.basic")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("detail.visibilityNote")}</p>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [t("col.name"), d.nickname ? `${d.nickname}（${d.name}）` : d.name],
                  [t("col.id"), `#${d.id}`],
                  [t("col.attribute"), attr(d.contentAttribute)],
                  [t("col.visibility"), d.isPublic ? t("public") : t("private")],
                  [t("detail.createdAt"), f.date(d.createdAt)],
                  [t("col.lastIngested"), f.date(d.lastIngestedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-muted-foreground">{t("detail.source")}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{d.description || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("detail.composition")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("stockNote")} · {t("computedAt", { time: f.date(detail.computedAt) })}
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[
                [t("col.entries"), f.num(d.entries), ""],
                [t("col.textEntries"), f.num(d.textEntries), ""],
                [t("media.audio"), f.num(d.media.audio.count), f.duration(d.media.audio.duration, d.media.audio.count)],
                [t("media.video"), f.num(d.media.video.count), f.duration(d.media.video.duration, d.media.video.count)],
                [t("media.image"), f.num(d.media.image.count), ""],
                [t("media.model3d"), f.num(d.media.model3d.count), ""],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-xl border p-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
                  {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("detail.capacity")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("col.size")}：{f.size(d.size, resources)}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {capacityRows.map(([label, kind]) => {
                if (kind === "text")
                  return (
                    <div key={kind} className="flex items-center justify-between gap-3 text-sm">
                      <span>{label}</span>
                      <span className="text-muted-foreground">{t("capacity.textNote")}</span>
                    </div>
                  );
                const stat = d.media[kind];
                const share = knownTotal > 0 && stat.size.value > 0 ? stat.size.value / knownTotal : 0;
                return (
                  <div key={kind} className="space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {label} <span className="text-muted-foreground">({f.num(stat.count)})</span>
                      </span>
                      <span className="tabular-nums">
                        {f.size(stat.size, stat.count)}
                        {share > 0 && <span className="ml-2 text-muted-foreground">{(share * 100).toFixed(1)}%</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {knownTotal > 0 && <p className="pt-1 text-xs text-muted-foreground">{t("capacity.shareNote", { total: formatBytes(knownTotal) })}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">{t("detail.trend")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("detail.trendNote", { from: range.from, to: range.to })}</p>
              </div>
              <div className="flex rounded-md border p-0.5" role="group" aria-label={t("detail.trend")}>
                {PRESETS.map((p) => (
                  <Button key={p} size="sm" variant={days === p ? "secondary" : "ghost"} aria-pressed={days === p} onClick={() => setDays(p)}>
                    {t("detail.days", { days: p })}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <p className="text-sm text-muted-foreground">{t("detail.newEntries")}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{f.num(detail.periodEntries)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-sm text-muted-foreground">{t("detail.newAv")}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {f.duration(detail.periodAvSeconds, detail.periodAvResources)}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <TrendChart data={detail.trend} dataKey="entries" label={t("detail.newEntries")} format={f.num} />
                <TrendChart data={detail.trend} dataKey="avMinutes" label={t("detail.newAvMinutes")} format={(v) => `${v.toFixed(v >= 10 ? 0 : 1)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("detail.records")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="py-4 text-center text-sm text-muted-foreground">{t("detail.recordsPending")}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
