"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Heart, MessageCircle, Radio, XCircle } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Summary = {
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  totalActivities: number;
  publishedActivities: number;
  totalLikes: number;
  totalComments: number;
};

type Trends = {
  items: Array<{ period: string; total: number; approved: number; rejected: number; pending: number }>;
};

type Breakdown = {
  types: Array<{ submissionType: string; total: number; approved: number; rejected: number }>;
  tags: Array<{ tag: string; total: number }>;
};

type ActivityDetail = {
  activity: { id: string; title: string; submissionCount?: number };
  statusBreakdown: Array<{ status: string; total: number }>;
  interactions: { likes: number; comments: number; shares: number; views: number };
};

export default function CorpusCollectionAnalyticsPage() {
  const [activityId, setActivityId] = useState("");
  const { data } = useQuery<Summary>({
    queryKey: ["corpus-collection-analytics-summary"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/analytics/summary");
      if (!response.ok) throw new Error("Failed to load summary");
      return response.json();
    },
  });

  const { data: trends } = useQuery<Trends>({
    queryKey: ["corpus-collection-analytics-trends"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/analytics/submission-trends?days=30");
      if (!response.ok) throw new Error("Failed to load trends");
      return response.json();
    },
  });

  const { data: breakdown } = useQuery<Breakdown>({
    queryKey: ["corpus-collection-analytics-breakdown"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/analytics/category-breakdown");
      if (!response.ok) throw new Error("Failed to load category breakdown");
      return response.json();
    },
  });

  const { data: activityDetail } = useQuery<ActivityDetail>({
    queryKey: ["corpus-collection-analytics-activity", activityId],
    enabled: /^\d+$/.test(activityId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/analytics/activity/${activityId}`);
      if (!response.ok) throw new Error("Failed to load activity analytics");
      return response.json();
    },
  });

  const cards = [
    { label: "Total Submissions", value: data?.totalSubmissions ?? 0, icon: Activity },
    { label: "Pending Review", value: data?.pendingSubmissions ?? 0, icon: Clock },
    { label: "Approved", value: data?.approvedSubmissions ?? 0, icon: CheckCircle2 },
    { label: "Rejected", value: data?.rejectedSubmissions ?? 0, icon: XCircle },
    { label: "Activities", value: data?.totalActivities ?? 0, icon: Radio },
    { label: "Published", value: data?.publishedActivities ?? 0, icon: Radio },
    { label: "Likes", value: data?.totalLikes ?? 0, icon: Heart },
    { label: "Comments", value: data?.totalComments ?? 0, icon: MessageCircle },
  ];

  const approvedRate =
    data && data.totalSubmissions > 0
      ? Math.round((data.approvedSubmissions / data.totalSubmissions) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h2>
        <p className="text-muted-foreground mt-2">Submission, activity, and interaction metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{card.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{card.value}</div>
                </div>
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Review Health</CardTitle>
          <CardDescription>High-level review completion snapshot.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Approval Rate</div>
              <div className="mt-2 text-3xl font-bold">{approvedRate}%</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Review Backlog</div>
              <div className="mt-2 text-3xl font-bold">{data?.pendingSubmissions ?? 0}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Interaction Total</div>
              <div className="mt-2 text-3xl font-bold">{(data?.totalLikes ?? 0) + (data?.totalComments ?? 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Submission Trends</CardTitle>
            <CardDescription>Daily review state movement over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends?.items.slice(-10).map((row) => (
                  <TableRow key={row.period}>
                    <TableCell>{new Date(row.period).toLocaleDateString()}</TableCell>
                    <TableCell>{row.total}</TableCell>
                    <TableCell>{row.approved}</TableCell>
                    <TableCell>{row.pending}</TableCell>
                    <TableCell>{row.rejected}</TableCell>
                  </TableRow>
                )) ?? <TableRow><TableCell colSpan={5}>No trend data.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Submission volume by type and top tags.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium">Types</div>
              <div className="space-y-2">
                {breakdown?.types.map((row) => (
                  <div key={row.submissionType} className="rounded-md border p-3">
                    <div className="flex justify-between text-sm">
                      <span>{row.submissionType}</span>
                      <span className="font-medium">{row.total}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      approved {row.approved} · rejected {row.rejected}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Top Tags</div>
              <div className="space-y-2">
                {breakdown?.tags.slice(0, 8).map((row) => (
                  <div key={row.tag} className="flex justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{row.tag}</span>
                    <span className="font-medium">{row.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Activity Detail</CardTitle>
          <CardDescription>Enter an activity ID to inspect activity-level interactions and review state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input className="max-w-xs" placeholder="Activity ID" value={activityId} onChange={(e) => setActivityId(e.target.value)} />
          {activityDetail && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Activity</div>
                <div className="mt-2 font-semibold">{activityDetail.activity.title}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Views</div>
                <div className="mt-2 text-2xl font-bold">{activityDetail.interactions.views}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Shares</div>
                <div className="mt-2 text-2xl font-bold">{activityDetail.interactions.shares}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Review States</div>
                <div className="mt-2 text-sm">
                  {activityDetail.statusBreakdown.map((row) => `${row.status}: ${row.total}`).join(" · ")}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
