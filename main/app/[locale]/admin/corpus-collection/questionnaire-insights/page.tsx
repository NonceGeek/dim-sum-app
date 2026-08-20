"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ClipboardCheck, RefreshCw, Send, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const dateRanges = {
  today: 1,
  "7d": 7,
  "30d": 30,
  quarter: 90,
} as const;

function rate(value: number | null) {
  return value === null ? "样本量不足" : `${value.toFixed(1)}%`;
}

function DistributionCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: DimensionRow[];
}) {
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
          <p className="py-8 text-center text-sm text-muted-foreground">当前筛选范围内暂无数据</p>
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
  const [dateRange, setDateRange] = useState<keyof typeof dateRanges>("30d");
  const [activityId, setActivityId] = useState("all");
  const [submissionStatus, setSubmissionStatus] = useState("all");
  const [registrationType, setRegistrationType] = useState("all");
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

  const knownActivities = data?.availableActivities ?? [];
  const kpis = [
    {
      label: "已完成参赛前登记",
      value: data?.kpis.completedRegistrations.toLocaleString() ?? "0",
      description: "筛选期间首次完成登记的用户",
      icon: ClipboardCheck,
    },
    {
      label: "登记后投稿率",
      value: `${(data?.kpis.postRegistrationSubmissionRate ?? 0).toFixed(1)}%`,
      description: "已登记用户在归因窗口内投稿",
      icon: Send,
    },
    {
      label: "资料复用率",
      value: `${(data?.kpis.profileReuseRate ?? 0).toFixed(1)}%`,
      description: "再次参与时复用已有资料",
      icon: UsersRound,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Questionnaire Insights</h2>
          <p className="mt-2 text-muted-foreground">参赛前登记、转化路径与去标识化用户画像。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled title="聚合导出将在 Phase 5 开放">
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            导出聚合报表
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="刷新">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as keyof typeof dateRanges)}>
            <SelectTrigger aria-label="时间范围"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="7d">近 7 天</SelectItem>
              <SelectItem value="30d">近 30 天</SelectItem>
              <SelectItem value="quarter">本季度</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activityId} onValueChange={setActivityId}>
            <SelectTrigger aria-label="活动筛选"><SelectValue placeholder="全部活动" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部活动</SelectItem>
              {knownActivities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>{activity.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={submissionStatus} onValueChange={setSubmissionStatus}>
            <SelectTrigger aria-label="投稿状态"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部投稿状态</SelectItem>
              <SelectItem value="submitted">已投稿</SelectItem>
              <SelectItem value="not_submitted">未投稿</SelectItem>
            </SelectContent>
          </Select>
          <Select value={registrationType} onValueChange={setRegistrationType}>
            <SelectTrigger aria-label="登记方式"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部登记方式</SelectItem>
              <SelectItem value="first_time">首次登记</SelectItem>
              <SelectItem value="reused">复用资料</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">数据加载失败，请重试</p>
          <Button variant="outline" onClick={() => refetch()}>重新加载</Button>
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
            <div>
              <h3 id="conversion-title" className="text-xl font-semibold">参与转化路径</h3>
              <p className="text-sm text-muted-foreground">首次登记与资料复用独立统计，避免漏斗口径混合。</p>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <FunnelCard title="首次登记漏斗" description="点击投稿后完成问卷并提交作品" rows={data?.funnels.firstTime ?? []} />
              <FunnelCard title="资料复用路径" description="已有档案用户直接进入投稿" rows={data?.funnels.reused ?? []} />
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="profile-title">
            <div>
              <h3 id="profile-title" className="text-xl font-semibold">用户画像</h3>
              <p className="text-sm text-muted-foreground">只展示去标识化聚合数据；少于 {data?.privacy.minimumSampleSize ?? 10} 人不展示精确转化率。</p>
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <DistributionCard title="年龄区间" description="完成登记用户的年龄分布" rows={data?.profile.ageRanges ?? []} />
              <DistributionCard title="语言文化地区偏好" description="问卷地区选项人数排行" rows={data?.profile.cultureRegions ?? []} />
              <DistributionCard title="兴趣类型" description="选填、多选的用户兴趣" rows={data?.profile.interestTypes ?? []} />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>活动 × 人群效果</CardTitle>
              <CardDescription>活动标签来自活动配置，与用户兴趣类型保持独立。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>活动</TableHead>
                    <TableHead>登记人数</TableHead>
                    <TableHead>投稿转化率</TableHead>
                    <TableHead>主要年龄段</TableHead>
                    <TableHead>地区偏好</TableHead>
                    <TableHead>活动标签</TableHead>
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
                      <TableCell>{rate(activity.submissionRate)}</TableCell>
                      <TableCell>{activity.topAgeRange}</TableCell>
                      <TableCell>{activity.topCultureRegion}</TableCell>
                      <TableCell><Badge variant="outline">{activity.activityTag}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!data?.activities.length && (
                    <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">当前筛选范围内暂无足够数据形成画像</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
