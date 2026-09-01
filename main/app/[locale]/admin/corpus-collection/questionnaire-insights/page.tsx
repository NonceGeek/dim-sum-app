"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownToLine, ClipboardCheck, RefreshCw, Send, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatActivityDate } from "@/lib/activity-time";

type DimensionRow = {
  code: string;
  label: string;
  count: number;
  submittedCount: number | null;
  submissionRate: number | null;
  suppressed: boolean;
};

type Overview = {
  kpis: {
    completedRegistrations: number;
    postRegistrationSubmissionRate: number;
    profileReuseRate: number;
  };
  availableActivities: Array<{ id: string; title: string }>;
  funnels: {
    firstTime: Array<{ key: string; label: string; count: number }>;
    reused: Array<{ key: string; label: string; count: number }>;
  };
  profile: {
    ageRanges: DimensionRow[];
    cultureRegions: DimensionRow[];
    interestTypes: DimensionRow[];
  };
  activities: Array<{
    id: string;
    title: string;
    status: string;
    registrationCount: number;
    submissionRate: number | null;
    suppressed: boolean;
    topAgeRange: string;
    topCultureRegion: string;
    activityTag: string;
  }>;
  privacy: { minimumSampleSize: number };
};

type FunnelDetail = {
  firstTime: Array<{ key: string; label: string; count: number; completionRate: number; lossFromPrevious: number }>;
  reused: Array<{ key: string; label: string; count: number; completionRate: number; lossFromPrevious: number }>;
  maximumLoss: { label: string; lossFromPrevious: number } | null;
};

type ProfileDetail = {
  dimension: "age" | "region" | "interest";
  sampleSize: number;
  leadingGroup: { label: string; count: number; share: number } | null;
  rows: Array<DimensionRow & { share: number }>;
};

type ComparisonActivity = Overview["activities"][number] & {
  questionnaireCompletionRate: number | null;
  timeStatus: string;
  startsAt: string | null;
  endsAt: string | null;
};

type ActivityComparison = {
  summary: { activityCount: number; ongoingCount: number; endedCount: number };
  ongoing: ComparisonActivity[];
  ended: ComparisonActivity[];
};

const dateRanges = {
  today: 1,
  "7d": 7,
  "30d": 30,
  quarter: 90,
} as const;

function DistributionCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: DimensionRow[];
}) {
  const t = useTranslations("QuestionnaireInsights");
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.filter((row) => row.count > 0).slice(0, 8).map((row) => (
          <div key={row.code} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="font-medium tabular-nums">{row.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {!rows.some((row) => row.count > 0) && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ key: string; label: string; count: number }>;
}) {
  const start = Math.max(rows[0]?.count ?? 0, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(8rem,1fr)_3fr_auto] items-center gap-3">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <div className="h-8 overflow-hidden rounded-md bg-muted">
              <div
                className="flex h-full min-w-1 items-center rounded-md bg-primary/85 px-2 text-xs font-medium text-primary-foreground"
                style={{ width: `${Math.max(2, (row.count / start) * 100)}%` }}
              >
                {((row.count / start) * 100).toFixed(1)}%
              </div>
            </div>
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{row.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function QuestionnaireInsightsPage() {
  const t = useTranslations("QuestionnaireInsights");
  const locale = useLocale();
  const [dateRange, setDateRange] = useState<keyof typeof dateRanges>("30d");
  const [activityId, setActivityId] = useState("all");
  const [submissionStatus, setSubmissionStatus] = useState("all");
  const [registrationType, setRegistrationType] = useState("all");
  const [detailView, setDetailView] = useState<"funnel" | "activity" | null>(null);
  const [profileDimension, setProfileDimension] = useState<"age" | "region" | "interest" | null>(null);
  const params = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - dateRanges[dateRange] * 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      submissionStatus,
      registrationType,
    });
    if (activityId !== "all") query.set("activityId", activityId);
    return query.toString();
  }, [activityId, dateRange, registrationType, submissionStatus]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Overview>({
    queryKey: ["questionnaire-insights", params],
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/questionnaire-insights/overview?${params}`);
      if (!response.ok) throw new Error("Failed to load questionnaire insights");
      return response.json();
    },
  });
  const { data: funnelDetail, isLoading: funnelLoading } = useQuery<FunnelDetail>({
    queryKey: ["questionnaire-funnel-detail", params],
    enabled: detailView === "funnel",
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/questionnaire-insights/funnel-detail?${params}`);
      if (!response.ok) throw new Error("Failed to load funnel detail");
      return response.json();
    },
  });
  const { data: profileDetail, isLoading: profileLoading } = useQuery<ProfileDetail>({
    queryKey: ["questionnaire-profile-detail", params, profileDimension],
    enabled: Boolean(profileDimension),
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/corpus-collection/questionnaire-insights/profile-detail?${params}&dimension=${profileDimension}`,
      );
      if (!response.ok) throw new Error("Failed to load profile detail");
      return response.json();
    },
  });
  const { data: activityComparison, isLoading: comparisonLoading } = useQuery<ActivityComparison>({
    queryKey: ["questionnaire-activity-comparison", params],
    enabled: detailView === "activity",
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/corpus-collection/questionnaire-insights/activity-comparison?${params}&limit=5`,
      );
      if (!response.ok) throw new Error("Failed to load activity comparison");
      return response.json();
    },
  });

  const knownActivities = data?.availableActivities ?? [];
  const formatRate = (value: number | null) =>
    value === null ? t("insufficientSample") : `${value.toFixed(1)}%`;
  const kpis = [
    {
      label: t("kpis.completed.label"),
      value: data?.kpis.completedRegistrations.toLocaleString() ?? "0",
      description: t("kpis.completed.description"),
      icon: ClipboardCheck,
    },
    {
      label: t("kpis.submissionRate.label"),
      value: `${(data?.kpis.postRegistrationSubmissionRate ?? 0).toFixed(1)}%`,
      description: t("kpis.submissionRate.description"),
      icon: Send,
    },
    {
      label: t("kpis.reuseRate.label"),
      value: `${(data?.kpis.profileReuseRate ?? 0).toFixed(1)}%`,
      description: t("kpis.reuseRate.description"),
      icon: UsersRound,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDetailView("activity")}>
            {t("activityComparison")}
          </Button>
          <Button variant="outline" disabled title={t("exportUnavailable")}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            {t("exportReport")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label={t("refresh")}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as keyof typeof dateRanges)}>
            <SelectTrigger aria-label={t("filters.dateRange")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("filters.today")}</SelectItem>
              <SelectItem value="7d">{t("filters.sevenDays")}</SelectItem>
              <SelectItem value="30d">{t("filters.thirtyDays")}</SelectItem>
              <SelectItem value="quarter">{t("filters.quarter")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger aria-label={t("filters.activity")}><SelectValue placeholder={t("filters.allActivities")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allActivities")}</SelectItem>
              {knownActivities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>{activity.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={submissionStatus} onValueChange={setSubmissionStatus}>
            <SelectTrigger aria-label={t("filters.submissionStatus")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allSubmissionStatuses")}</SelectItem>
              <SelectItem value="submitted">{t("filters.submitted")}</SelectItem>
              <SelectItem value="not_submitted">{t("filters.notSubmitted")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={registrationType} onValueChange={setRegistrationType}>
            <SelectTrigger aria-label={t("filters.registrationType")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allRegistrationTypes")}</SelectItem>
              <SelectItem value="first_time">{t("filters.firstTime")}</SelectItem>
              <SelectItem value="reused">{t("filters.reused")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
          <Button variant="outline" onClick={() => refetch()}>{t("reload")}</Button>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="flex items-start justify-between pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    {isLoading ? <Skeleton className="mt-3 h-9 w-24" /> : <p className="mt-2 text-3xl font-bold tabular-nums">{kpi.value}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{kpi.description}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><kpi.icon className="h-5 w-5" /></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <section className="space-y-3" aria-labelledby="conversion-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="conversion-title" className="text-xl font-semibold">{t("conversion.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("conversion.description")}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetailView("funnel")}>{t("conversion.viewDetails")}</Button>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <FunnelCard title={t("conversion.firstTimeTitle")} description={t("conversion.firstTimeDescription")} rows={data?.funnels.firstTime ?? []} />
              <FunnelCard title={t("conversion.reusedTitle")} description={t("conversion.reusedDescription")} rows={data?.funnels.reused ?? []} />
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="profile-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="profile-title" className="text-xl font-semibold">{t("profile.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("profile.description", { count: data?.privacy.minimumSampleSize ?? 10 })}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setProfileDimension("age")}>{t("profile.ageDetails")}</Button>
                <Button variant="outline" size="sm" onClick={() => setProfileDimension("region")}>{t("profile.regionDetails")}</Button>
                <Button variant="outline" size="sm" onClick={() => setProfileDimension("interest")}>{t("profile.interestDetails")}</Button>
              </div>
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <DistributionCard title={t("profile.ageTitle")} description={t("profile.ageDescription")} rows={data?.profile.ageRanges ?? []} />
              <DistributionCard title={t("profile.regionTitle")} description={t("profile.regionDescription")} rows={data?.profile.cultureRegions ?? []} />
              <DistributionCard title={t("profile.interestTitle")} description={t("profile.interestDescription")} rows={data?.profile.interestTypes ?? []} />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t("activityTable.title")}</CardTitle>
              <CardDescription>{t("activityTable.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("activityTable.activity")}</TableHead>
                    <TableHead>{t("activityTable.registrations")}</TableHead>
                    <TableHead>{t("activityTable.submissionRate")}</TableHead>
                    <TableHead>{t("activityTable.topAge")}</TableHead>
                    <TableHead>{t("activityTable.region")}</TableHead>
                    <TableHead>{t("activityTable.tag")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="font-medium">{activity.title}</div>
                        <Badge variant="secondary" className="mt-1">{activity.status}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{activity.registrationCount}</TableCell>
                      <TableCell>{formatRate(activity.submissionRate)}</TableCell>
                      <TableCell>{activity.topAgeRange}</TableCell>
                      <TableCell>{activity.topCultureRegion}</TableCell>
                      <TableCell><Badge variant="outline">{activity.activityTag}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!data?.activities.length && (
                    <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">{t("activityTable.empty")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={detailView === "funnel"} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("funnelDialog.title")}</DialogTitle>
            <DialogDescription>{t("funnelDialog.description")}</DialogDescription>
          </DialogHeader>
          {funnelLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="space-y-6">
              {funnelDetail?.maximumLoss && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">{t("funnelDialog.maximumLoss")}</p>
                  <p className="mt-1 text-lg font-semibold">{funnelDetail.maximumLoss.label}</p>
                  <p className="text-sm text-destructive">{t("funnelDialog.lossCount", { count: funnelDetail.maximumLoss.lossFromPrevious })}</p>
                </div>
              )}
              {[
                [t("funnelDialog.firstTime"), funnelDetail?.firstTime ?? []],
                [t("funnelDialog.reused"), funnelDetail?.reused ?? []],
              ].map(([title, rows]) => (
                <div key={title as string}>
                  <h4 className="mb-3 font-semibold">{title as string}</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("funnelDialog.step")}</TableHead><TableHead>{t("funnelDialog.people")}</TableHead><TableHead>{t("funnelDialog.completionRate")}</TableHead><TableHead>{t("funnelDialog.lossFromPrevious")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(rows as FunnelDetail["firstTime"]).map((row) => (
                        <TableRow key={row.key}><TableCell>{row.label}</TableCell><TableCell>{row.count}</TableCell><TableCell>{row.completionRate.toFixed(1)}%</TableCell><TableCell>{row.lossFromPrevious}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(profileDimension)} onOpenChange={(open) => !open && setProfileDimension(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("profileDialog.title")}</DialogTitle>
            <DialogDescription>{t("profileDialog.description")}</DialogDescription>
          </DialogHeader>
          {profileLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t("profileDialog.sampleSize")}</p><p className="mt-1 text-2xl font-bold">{profileDetail?.sampleSize ?? 0}</p></div>
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t("profileDialog.leadingGroup")}</p><p className="mt-1 text-lg font-semibold">{profileDetail?.leadingGroup?.label ?? "—"}</p><p className="text-sm text-muted-foreground">{profileDetail?.leadingGroup?.share.toFixed(1) ?? "0.0"}%</p></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>{t("profileDialog.group")}</TableHead><TableHead>{t("profileDialog.people")}</TableHead><TableHead>{t("profileDialog.share")}</TableHead><TableHead>{t("profileDialog.submissionRate")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {profileDetail?.rows.map((row) => (
                    <TableRow key={row.code}><TableCell>{row.label}</TableCell><TableCell>{row.count}</TableCell><TableCell>{row.share.toFixed(1)}%</TableCell><TableCell>{formatRate(row.submissionRate)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detailView === "activity"} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("comparisonDialog.title")}</DialogTitle>
            <DialogDescription>{t("comparisonDialog.description")}</DialogDescription>
          </DialogHeader>
          {comparisonLoading ? <Skeleton className="h-72 w-full" /> : (
            <div className="space-y-6">
              {[
                [t("comparisonDialog.ongoing"), activityComparison?.ongoing ?? []],
                [t("comparisonDialog.ended"), activityComparison?.ended ?? []],
              ].map(([title, rows]) => (
                <div key={title as string}>
                  <h4 className="mb-3 font-semibold">{title as string}</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("comparisonDialog.activity")}</TableHead><TableHead>{t("comparisonDialog.registrations")}</TableHead><TableHead>{t("comparisonDialog.completionRate")}</TableHead><TableHead>{t("comparisonDialog.submissionRate")}</TableHead><TableHead>{t("comparisonDialog.topAge")}</TableHead><TableHead>{t("comparisonDialog.region")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(rows as ComparisonActivity[]).map((activity) => (
                        <TableRow key={activity.id}><TableCell><div className="font-medium">{activity.title}</div><div className="text-xs text-muted-foreground">{activity.endsAt ? t("comparisonDialog.endsAt", { date: formatActivityDate(activity.endsAt, locale) }) : t("comparisonDialog.longRunning")}</div></TableCell><TableCell>{activity.registrationCount}</TableCell><TableCell>{formatRate(activity.questionnaireCompletionRate)}</TableCell><TableCell>{formatRate(activity.submissionRate)}</TableCell><TableCell>{activity.topAgeRange}</TableCell><TableCell>{activity.topCultureRegion}</TableCell></TableRow>
                      ))}
                      {!(rows as ComparisonActivity[]).length && <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{t("comparisonDialog.empty")}</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
