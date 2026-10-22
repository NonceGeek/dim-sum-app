"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Download, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatDuration,
  measureState,
  toCsv,
  type MeasureLike,
} from "@/lib/analytics/corpus-assets-format";
import type { AssetDatasetRow, AssetOverview } from "@/lib/analytics/corpus-assets";

export type AssetSnapshot = { overview: AssetOverview; datasets: AssetDatasetRow[] };

export async function fetchAssets<T>(query = ""): Promise<T> {
  const res = await fetch(`/api/admin/analytics/assets${query}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body as T;
}

export function useAssetSnapshot() {
  return useQuery({
    queryKey: ["corpus-assets"],
    queryFn: () => fetchAssets<AssetSnapshot>(),
    staleTime: 5 * 60_000,
  });
}

/** Number, duration and size formatting that renders unmeasured data as "pending". */
export function useAssetFormat() {
  const t = useTranslations("CorpusAssets");
  const locale = useLocale();
  return useMemo(() => {
    const num = new Intl.NumberFormat(locale);
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    const units = { h: t("unit.h"), m: t("unit.m"), s: t("unit.s") };
    const measure = (m: MeasureLike, resources: number, render: (v: number) => string) => {
      const state = measureState(m, resources);
      if (state === "empty") return "—";
      if (state === "pending") return t("pending");
      const text = render(m.value);
      return state === "partial" ? `${text} ${t("partial", { count: m.missing })}` : text;
    };
    return {
      num: (v: number) => num.format(v),
      date: (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "—"),
      duration: (m: MeasureLike, resources: number) => measure(m, resources, (v) => formatDuration(v, units)),
      size: (m: MeasureLike, resources: number) => measure(m, resources, formatBytes),
      units,
    };
  }, [locale, t]);
}

export function UpdatedAt({ computedAt }: { computedAt: string }) {
  const t = useTranslations("CorpusAssets");
  const f = useAssetFormat();
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/analytics/assets", { method: "POST" });
      if (!res.ok) throw new Error("refresh failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["corpus-assets"] }),
  });
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t("computedAt", { time: f.date(computedAt) })}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => refresh.mutate()}
        disabled={refresh.isPending}
        aria-label={t("refresh")}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", refresh.isPending && "animate-spin")} />
      </Button>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AssetTiles({ o }: { o: AssetOverview }) {
  const t = useTranslations("CorpusAssets");
  const f = useAssetFormat();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label={t("kpi.datasets")} value={f.num(o.datasets)} hint={t("kpi.publicSplit", { public: o.publicDatasets, private: o.privateDatasets })} />
      <Tile label={t("kpi.entries")} value={f.num(o.entries)} />
      <Tile label={t("kpi.audioDuration")} value={f.duration(o.media.audio.duration, o.media.audio.count)} hint={t("kpi.files", { count: o.media.audio.count })} />
      <Tile label={t("kpi.videoDuration")} value={f.duration(o.media.video.duration, o.media.video.count)} hint={t("kpi.files", { count: o.media.video.count })} />
      <Tile label={t("kpi.images")} value={f.num(o.media.image.count)} />
      <Tile label={t("kpi.size")} value={f.size(o.size, o.resources)} hint={t("kpi.sizeHint")} />
      <Tile label={t("kpi.probed")} value={`${f.num(o.probedResources)} / ${f.num(o.resources)}`} hint={t("kpi.probedHint")} />
    </div>
  );
}

/** Platform overview card: current stock, independent of the dashboard date range. */
export function AssetSummaryCard({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("CorpusAssets");
  const q = useAssetSnapshot();
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{t("summaryTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("stockNote")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          {t("open")}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
        {q.error && <p className="py-6 text-center text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data && (
          <>
            <AssetTiles o={q.data.overview} />
            <UpdatedAt computedAt={q.data.overview.computedAt} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

const ATTRIBUTES = ["oral", "cultural_knowledge", "unclassified"] as const;
const MEDIA_FILTERS = ["audio", "video", "image", "model3d"] as const;
const SORTS = ["entries", "avDuration", "size", "lastIngested"] as const;
type Sort = (typeof SORTS)[number];
const PAGE_SIZE = 20;

const avSeconds = (d: AssetDatasetRow) => d.media.audio.duration.value + d.media.video.duration.value;

export function AssetsTab() {
  const t = useTranslations("CorpusAssets");
  const tAttr = useTranslations("AdminCategories.dataset");
  const f = useAssetFormat();
  const q = useAssetSnapshot();
  const [search, setSearch] = useState("");
  const [attribute, setAttribute] = useState("");
  const [visibility, setVisibility] = useState("");
  const [media, setMedia] = useState("");
  const [sort, setSort] = useState<Sort>("entries");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (q.data?.datasets ?? []).filter(
      (d) =>
        (!needle ||
          d.name.toLowerCase().includes(needle) ||
          (d.nickname ?? "").toLowerCase().includes(needle) ||
          String(d.id) === needle) &&
        (!attribute || d.contentAttribute === attribute) &&
        (!visibility || d.isPublic === (visibility === "public")) &&
        (!media || d.media[media as (typeof MEDIA_FILTERS)[number]].count > 0),
    );
    const key: Record<Sort, (d: AssetDatasetRow) => number> = {
      entries: (d) => d.entries,
      avDuration: avSeconds,
      size: (d) => d.size.value,
      lastIngested: (d) => (d.lastIngestedAt ? Date.parse(d.lastIngestedAt) : 0),
    };
    return [...list].sort((a, b) => key[sort](b) - key[sort](a) || a.name.localeCompare(b.name));
  }, [q.data, search, attribute, visibility, media, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const attrLabel = (v: string) => (ATTRIBUTES.includes(v as (typeof ATTRIBUTES)[number]) ? tAttr(v) : v);

  const exportCsv = () => {
    const header = [
      t("col.name"), t("col.id"), t("col.attribute"), t("col.visibility"), t("col.entries"), t("col.textEntries"),
      t("csv.audioCount"), t("csv.audioSeconds"), t("csv.audioPending"),
      t("csv.videoCount"), t("csv.videoSeconds"), t("csv.videoPending"),
      t("col.images"), t("csv.models"), t("csv.bytes"), t("csv.sizePending"), t("col.lastIngested"),
    ];
    const body = rows.map((d) => [
      d.nickname ? `${d.nickname} (${d.name})` : d.name, d.id, attrLabel(d.contentAttribute),
      d.isPublic ? t("public") : t("private"), d.entries, d.textEntries,
      d.media.audio.count, Math.round(d.media.audio.duration.value), d.media.audio.duration.missing,
      d.media.video.count, Math.round(d.media.video.duration.value), d.media.video.duration.missing,
      d.media.image.count, d.media.model3d.count, d.size.value, d.size.missing, d.lastIngestedAt ?? "",
    ]);
    const url = URL.createObjectURL(new Blob([toCsv(header, body)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `corpus-assets-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const select = (value: string, onChange: (v: string) => void, label: string, options: Array<[string, string]>) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setPage(1);
      }}
      className="h-9 rounded-md border bg-background px-2 text-sm"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );

  if (q.isLoading) return <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>;
  if (q.error) return <p className="py-10 text-center text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("stockNote")}</p>
        <UpdatedAt computedAt={q.data.overview.computedAt} />
      </div>
      <AssetTiles o={q.data.overview} />
      <Card>
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-56"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {select(attribute, setAttribute, t("col.attribute"), [["", t("filter.allAttributes")], ...ATTRIBUTES.map((v): [string, string] => [v, attrLabel(v)])])}
            {select(visibility, setVisibility, t("col.visibility"), [["", t("filter.allVisibility")], ["public", t("public")], ["private", t("private")]])}
            {select(media, setMedia, t("filter.media"), [["", t("filter.allMedia")], ...MEDIA_FILTERS.map((v): [string, string] => [v, t(`media.${v}`)])])}
            {select(sort, (v) => setSort(v as Sort), t("sort.label"), SORTS.map((v): [string, string] => [v, t(`sort.${v}`)]))}
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" />
              {t("export")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-card">{t("col.name")}</TableHead>
                      <TableHead>{t("col.attribute")}</TableHead>
                      <TableHead>{t("col.visibility")}</TableHead>
                      <TableHead className="text-right">{t("col.entries")}</TableHead>
                      <TableHead className="text-right">{t("col.textEntries")}</TableHead>
                      <TableHead className="text-right">{t("col.audio")}</TableHead>
                      <TableHead className="text-right">{t("col.video")}</TableHead>
                      <TableHead className="text-right">{t("col.images")}</TableHead>
                      <TableHead className="text-right">{t("col.size")}</TableHead>
                      <TableHead>{t("col.lastIngested")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((d) => (
                      <TableRow key={d.name}>
                        <TableCell className="sticky left-0 z-10 max-w-56 bg-card">
                          <Link href={`/admin/analytics/assets/${encodeURIComponent(d.name)}`} className="block truncate font-medium hover:underline">
                            {d.nickname || d.name}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {d.name} · #{d.id}
                          </span>
                        </TableCell>
                        <TableCell>{attrLabel(d.contentAttribute)}</TableCell>
                        <TableCell>
                          <Badge variant={d.isPublic ? "secondary" : "outline"}>{d.isPublic ? t("public") : t("private")}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.num(d.entries)}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.num(d.textEntries)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.num(d.media.audio.count)}
                          <span className="block text-xs text-muted-foreground">{f.duration(d.media.audio.duration, d.media.audio.count)}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.num(d.media.video.count)}
                          <span className="block text-xs text-muted-foreground">{f.duration(d.media.video.duration, d.media.video.count)}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.num(d.media.image.count)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.size(d.size, d.media.audio.count + d.media.video.count + d.media.image.count + d.media.model3d.count)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{f.date(d.lastIngestedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("total", { count: rows.length })}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                    {t("prev")}
                  </Button>
                  <span className="tabular-nums">
                    {current} / {pages}
                  </span>
                  <Button size="sm" variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                    {t("next")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
