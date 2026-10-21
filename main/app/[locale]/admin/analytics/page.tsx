"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Tab = "overview" | "search" | "content" | "traffic";
type Preset = "today" | "7d" | "30d" | "custom";

/** Calendar day in Asia/Shanghai, matching the API's day buckets. */
function shanghaiDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

function presetRange(preset: Exclude<Preset, "custom">) {
  const to = shanghaiDay();
  const from = preset === "today" ? to : shanghaiDay(preset === "7d" ? -6 : -29);
  return { from, to };
}

async function fetchTab<T>(tab: Tab, from: string, to: string): Promise<T> {
  const res = await fetch(`/api/admin/analytics?tab=${tab}&from=${from}&to=${to}`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body.data as T;
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

function useNumber() {
  const locale = useLocale();
  return useMemo(() => new Intl.NumberFormat(locale), [locale]);
}

/* ---------- Building blocks ---------- */

type Metric = { key: string; label: string; value: string; percent?: boolean };

/**
 * Metric tiles double as the trend selector: one series at a time, so measures of
 * different scale or unit never share an axis.
 */
function MetricTrend({
  metrics,
  daily,
  active,
  onSelect,
}: {
  metrics: Metric[];
  daily: Array<Record<string, string | number | null>>;
  active: string;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations("AdminAnalytics");
  const metric = metrics.find((m) => m.key === active) ?? metrics[0];
  const config = { [metric.key]: { label: metric.label, color: "var(--chart-1)" } } satisfies ChartConfig;
  const fmt = useNumber();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === metric.key}
            onClick={() => onSelect(m.key)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent",
              m.key === metric.key && "border-primary ring-1 ring-primary",
            )}
          >
            <p className="text-sm text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{m.value}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("trendTitle", { metric: metric.label })}</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>
          ) : (
            <ChartContainer config={config} className="aspect-auto h-64 w-full">
              <LineChart data={daily} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  allowDecimals={false}
                  tickFormatter={(v: number) => (metric.percent ? `${Math.round(v * 100)}%` : fmt.format(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium tabular-nums">
                          {metric.label}：{metric.percent ? pct(Number(value)) : fmt.format(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  dataKey={metric.key}
                  type="monotone"
                  stroke={`var(--color-${metric.key})`}
                  strokeWidth={2}
                  dot={daily.length <= 1 ? { r: 4 } : false}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Column<R> = { key: string; label: string; numeric?: boolean; render: (row: R) => React.ReactNode };

function RankTable<R>({
  title,
  hint,
  rows,
  columns,
}: {
  title: string;
  hint?: string;
  rows: R[];
  columns: Column<R>[];
}) {
  const t = useTranslations("AdminAnalytics");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.numeric ? "text-right" : undefined}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn("max-w-64 truncate", c.numeric && "text-right tabular-nums")}
                      >
                        {c.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TabState({ query, children }: { query: { isLoading: boolean; error: unknown }; children: React.ReactNode }) {
  const t = useTranslations("AdminAnalytics");
  if (query.isLoading) return <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>;
  if (query.error) return <p className="py-10 text-center text-destructive">{(query.error as Error).message}</p>;
  return <>{children}</>;
}

/* ---------- Tabs ---------- */

type OverviewData = {
  kpis: { pv: number; uv: number; sessions: number; searches: number; noPrimaryRate: number | null; shareCopies: number; shareOpens: number; videoPlays: number };
  daily: Array<{ day: string; pv: number; uv: number; searches: number; shares: number }>;
};

function OverviewTab({ from, to }: { from: string; to: string }) {
  const t = useTranslations("AdminAnalytics");
  const fmt = useNumber();
  const [metric, setMetric] = useState("pv");
  const q = useQuery({ queryKey: ["analytics", "overview", from, to], queryFn: () => fetchTab<OverviewData>("overview", from, to) });
  const k = q.data?.kpis;
  return (
    <TabState query={q}>
      {k && q.data && (
        <div className="space-y-4">
          <MetricTrend
            active={metric}
            onSelect={setMetric}
            daily={q.data.daily}
            metrics={[
              { key: "pv", label: t("kpi.pv"), value: fmt.format(k.pv) },
              { key: "uv", label: t("kpi.uv"), value: fmt.format(k.uv) },
              { key: "searches", label: t("kpi.searches"), value: fmt.format(k.searches) },
              { key: "shares", label: t("kpi.shares"), value: fmt.format(k.shareCopies + k.shareOpens) },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [t("kpi.sessions"), fmt.format(k.sessions)],
              [t("kpi.noPrimaryRate"), pct(k.noPrimaryRate)],
              [t("kpi.shareOpens"), fmt.format(k.shareOpens)],
              [t("kpi.videoPlays"), fmt.format(k.videoPlays)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabState>
  );
}

type SearchData = {
  totals: { searches: number; noPrimaryRate: number | null; p95: number | null };
  topQueries: Array<{ query: string; searches: number; users: number }>;
  noPrimaryQueries: Array<{ query: string; searches: number }>;
  sections: Array<{ section: string; impressions: number; emptyRate: number | null; avgResults: number; clicks: number; ctr: number | null }>;
  mediaFilters: Array<{ mediaType: string; changes: number }>;
  latency: Array<{ section: string; requests: number; p50: number; p95: number; max: number }>;
  fallbacks: Array<{ status: string; reason: string; requests: number }>;
  daily: Array<{ day: string; searches: number; noPrimaryRate: number | null; p95: number | null }>;
};

function SearchTab({ from, to }: { from: string; to: string }) {
  const t = useTranslations("AdminAnalytics");
  const fmt = useNumber();
  const [metric, setMetric] = useState("searches");
  const q = useQuery({ queryKey: ["analytics", "search", from, to], queryFn: () => fetchTab<SearchData>("search", from, to) });
  const d = q.data;
  return (
    <TabState query={q}>
      {d && (
        <div className="space-y-4">
          <MetricTrend
            active={metric}
            onSelect={setMetric}
            daily={d.daily}
            metrics={[
              { key: "searches", label: t("kpi.searches"), value: fmt.format(d.totals.searches) },
              { key: "noPrimaryRate", label: t("kpi.noPrimaryRate"), value: pct(d.totals.noPrimaryRate), percent: true },
              { key: "p95", label: t("search.p95"), value: d.totals.p95 === null ? "—" : `${fmt.format(d.totals.p95)} ms` },
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <RankTable
              title={t("search.topQueries")}
              rows={d.topQueries}
              columns={[
                { key: "q", label: t("col.query"), render: (r) => r.query },
                { key: "s", label: t("col.searches"), numeric: true, render: (r) => fmt.format(r.searches) },
                { key: "u", label: t("col.users"), numeric: true, render: (r) => fmt.format(r.users) },
              ]}
            />
            <RankTable
              title={t("search.noPrimaryQueries")}
              hint={t("search.noPrimaryHint")}
              rows={d.noPrimaryQueries}
              columns={[
                { key: "q", label: t("col.query"), render: (r) => r.query },
                { key: "s", label: t("col.searches"), numeric: true, render: (r) => fmt.format(r.searches) },
              ]}
            />
            <RankTable
              title={t("search.sections")}
              hint={t("search.sectionsHint")}
              rows={d.sections}
              columns={[
                { key: "s", label: t("col.section"), render: (r) => t(`section.${r.section}`) },
                { key: "i", label: t("col.impressions"), numeric: true, render: (r) => fmt.format(r.impressions) },
                { key: "e", label: t("col.emptyRate"), numeric: true, render: (r) => pct(r.emptyRate) },
                { key: "c", label: t("col.clicks"), numeric: true, render: (r) => fmt.format(r.clicks) },
                { key: "r", label: t("col.ctr"), numeric: true, render: (r) => pct(r.ctr) },
              ]}
            />
            <RankTable
              title={t("search.latency")}
              hint={t("search.latencyHint")}
              rows={d.latency}
              columns={[
                { key: "s", label: t("col.requestSection"), render: (r) => r.section },
                { key: "n", label: t("col.requests"), numeric: true, render: (r) => fmt.format(r.requests) },
                { key: "p50", label: "p50 (ms)", numeric: true, render: (r) => fmt.format(r.p50) },
                { key: "p95", label: "p95 (ms)", numeric: true, render: (r) => fmt.format(r.p95) },
                { key: "max", label: "max (ms)", numeric: true, render: (r) => fmt.format(r.max) },
              ]}
            />
            <RankTable
              title={t("search.fallbacks")}
              rows={d.fallbacks}
              columns={[
                { key: "st", label: t("col.status"), render: (r) => r.status },
                { key: "rs", label: t("col.reason"), render: (r) => r.reason },
                { key: "n", label: t("col.requests"), numeric: true, render: (r) => fmt.format(r.requests) },
              ]}
            />
            <RankTable
              title={t("search.mediaFilters")}
              rows={d.mediaFilters}
              columns={[
                { key: "m", label: t("col.mediaType"), render: (r) => r.mediaType },
                { key: "n", label: t("col.changes"), numeric: true, render: (r) => fmt.format(r.changes) },
              ]}
            />
          </div>
        </div>
      )}
    </TabState>
  );
}

type ContentData = {
  video: Array<{ surface: string; plays: number; failures: number; failureRate: number | null }>;
  shareFunnel: { cardOpens: number; linkCopies: number; imageDownloads: number; cardLinkClicks: number; linkOpens: number };
  topEntries: Array<{ entryId: string; name: string | null; clicks: number; shares: number; shareOpens: number; videoPlays: number }>;
};

function ContentTab({ from, to }: { from: string; to: string }) {
  const t = useTranslations("AdminAnalytics");
  const fmt = useNumber();
  const q = useQuery({ queryKey: ["analytics", "content", from, to], queryFn: () => fetchTab<ContentData>("content", from, to) });
  const d = q.data;
  const funnel = d
    ? [
        { step: t("share.cardOpens"), value: d.shareFunnel.cardOpens },
        { step: t("share.linkCopies"), value: d.shareFunnel.linkCopies },
        { step: t("share.imageDownloads"), value: d.shareFunnel.imageDownloads },
        { step: t("share.cardLinkClicks"), value: d.shareFunnel.cardLinkClicks },
        { step: t("share.linkOpens"), value: d.shareFunnel.linkOpens },
      ]
    : [];
  return (
    <TabState query={q}>
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RankTable
            title={t("content.video")}
            rows={d.video}
            columns={[
              { key: "s", label: t("col.surface"), render: (r) => t.has(`surface.${r.surface}`) ? t(`surface.${r.surface}`) : r.surface },
              { key: "p", label: t("col.plays"), numeric: true, render: (r) => fmt.format(r.plays) },
              { key: "f", label: t("col.failures"), numeric: true, render: (r) => fmt.format(r.failures) },
              { key: "r", label: t("col.failureRate"), numeric: true, render: (r) => pct(r.failureRate) },
            ]}
          />
          <RankTable
            title={t("content.shareFunnel")}
            hint={t("content.shareFunnelHint")}
            rows={funnel}
            columns={[
              { key: "s", label: t("col.step"), render: (r) => r.step },
              { key: "v", label: t("col.events"), numeric: true, render: (r) => fmt.format(r.value) },
            ]}
          />
          <div className="lg:col-span-2">
            <RankTable
              title={t("content.topEntries")}
              rows={d.topEntries}
              columns={[
                {
                  key: "e",
                  label: t("col.entry"),
                  render: (r) => (
                    <a href={`/entries/${r.entryId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {r.name ?? r.entryId.slice(0, 8)}
                    </a>
                  ),
                },
                { key: "c", label: t("col.clicks"), numeric: true, render: (r) => fmt.format(r.clicks) },
                { key: "s", label: t("col.shares"), numeric: true, render: (r) => fmt.format(r.shares) },
                { key: "o", label: t("col.shareOpens"), numeric: true, render: (r) => fmt.format(r.shareOpens) },
                { key: "v", label: t("col.plays"), numeric: true, render: (r) => fmt.format(r.videoPlays) },
              ]}
            />
          </div>
        </div>
      )}
    </TabState>
  );
}

type TrafficData = {
  pages: Array<{ route: string; pv: number; uv: number }>;
  referrers: Array<{ referrer: string; visits: number; uv: number }>;
  devices: Array<{ device: string; uv: number; pv: number }>;
  locales: Array<{ locale: string; uv: number; pv: number }>;
};

function TrafficTab({ from, to }: { from: string; to: string }) {
  const t = useTranslations("AdminAnalytics");
  const fmt = useNumber();
  const q = useQuery({ queryKey: ["analytics", "traffic", from, to], queryFn: () => fetchTab<TrafficData>("traffic", from, to) });
  const d = q.data;
  const share = (part: number, rows: Array<{ uv: number }>) => {
    const total = rows.reduce((s, r) => s + r.uv, 0);
    return total ? pct(part / total) : "—";
  };
  return (
    <TabState query={q}>
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RankTable
            title={t("traffic.pages")}
            rows={d.pages}
            columns={[
              { key: "r", label: t("col.page"), render: (r) => r.route },
              { key: "pv", label: "PV", numeric: true, render: (r) => fmt.format(r.pv) },
              { key: "uv", label: "UV", numeric: true, render: (r) => fmt.format(r.uv) },
            ]}
          />
          <RankTable
            title={t("traffic.referrers")}
            hint={t("traffic.referrersHint")}
            rows={d.referrers}
            columns={[
              { key: "r", label: t("col.referrer"), render: (r) => (r.referrer === "(direct)" ? t("traffic.direct") : r.referrer) },
              { key: "v", label: t("col.visits"), numeric: true, render: (r) => fmt.format(r.visits) },
              { key: "uv", label: "UV", numeric: true, render: (r) => fmt.format(r.uv) },
            ]}
          />
          <RankTable
            title={t("traffic.devices")}
            rows={d.devices}
            columns={[
              { key: "d", label: t("col.device"), render: (r) => (t.has(`device.${r.device}`) ? t(`device.${r.device}`) : r.device) },
              { key: "uv", label: "UV", numeric: true, render: (r) => fmt.format(r.uv) },
              { key: "s", label: t("col.share"), numeric: true, render: (r) => share(r.uv, d.devices) },
            ]}
          />
          <RankTable
            title={t("traffic.locales")}
            rows={d.locales}
            columns={[
              { key: "l", label: t("col.locale"), render: (r) => r.locale },
              { key: "uv", label: "UV", numeric: true, render: (r) => fmt.format(r.uv) },
              { key: "s", label: t("col.share"), numeric: true, render: (r) => share(r.uv, d.locales) },
            ]}
          />
        </div>
      )}
    </TabState>
  );
}

/* ---------- Page ---------- */

export default function AnalyticsDashboardPage() {
  const t = useTranslations("AdminAnalytics");
  const [preset, setPreset] = useState<Preset>("7d");
  const [range, setRange] = useState(presetRange("7d"));
  const [custom, setCustom] = useState(range);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const choose = (p: Exclude<Preset, "custom">) => {
    setPreset(p);
    setRange(presetRange(p));
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("title")}</h2>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5" role="group" aria-label={t("range")}>
            {(["today", "7d", "30d", "custom"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "secondary" : "ghost"}
                aria-pressed={preset === p}
                onClick={() => (p === "custom" ? setPreset("custom") : choose(p))}
              >
                {t(`preset.${p}`)}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.from && custom.to && custom.from <= custom.to) setRange(custom);
              }}
            >
              <Input type="date" className="h-8 w-36" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label={t("from")} />
              <span className="text-muted-foreground">—</span>
              <Input type="date" className="h-8 w-36" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label={t("to")} />
              <Button size="sm" type="submit">{t("apply")}</Button>
            </form>
          )}
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)} aria-label={t("refresh")}>
            <RefreshCw />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("rangeLabel", { from: range.from, to: range.to })}</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          {(["overview", "search", "content", "traffic"] as const).map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`tab.${x}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div key={refreshKey} className="mt-4">
          <TabsContent value="overview"><OverviewTab from={range.from} to={range.to} /></TabsContent>
          <TabsContent value="search"><SearchTab from={range.from} to={range.to} /></TabsContent>
          <TabsContent value="content"><ContentTab from={range.from} to={range.to} /></TabsContent>
          <TabsContent value="traffic"><TrafficTab from={range.from} to={range.to} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
