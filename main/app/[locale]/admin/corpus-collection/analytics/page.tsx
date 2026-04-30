"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Heart, MessageCircle, Radio, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function CorpusCollectionAnalyticsPage() {
  const { data } = useQuery<Summary>({
    queryKey: ["corpus-collection-analytics-summary"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/analytics/summary");
      if (!response.ok) throw new Error("Failed to load summary");
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
    </div>
  );
}
