"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

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

const modules = [
  {
    title: "Activities",
    description: "Create, publish, and manage collection campaigns.",
    href: "/admin/corpus-collection/activities",
  },
  {
    title: "Submissions",
    description: "Review user submissions and manage featured content.",
    href: "/admin/corpus-collection/submissions",
  },
  {
    title: "Categories",
    description: "Configure submission types and public tags.",
    href: "/admin/corpus-collection/categories",
  },
  {
    title: "AI Review Batches",
    description: "Track batch review progress and webhook results.",
    href: "/admin/corpus-collection/review-batches",
  },
  {
    title: "Analytics",
    description: "View submission trends, activity metrics, and interactions.",
    href: "/admin/corpus-collection/analytics",
  },
];

export default function CorpusCollectionAdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/corpus-collection/analytics/summary")
      .then((response) => (response.ok ? response.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const stats = [
    ["Total Submissions", summary?.totalSubmissions ?? 0],
    ["Pending Review", summary?.pendingSubmissions ?? 0],
    ["Approved", summary?.approvedSubmissions ?? 0],
    ["Rejected", summary?.rejectedSubmissions ?? 0],
    ["Activities", summary?.totalActivities ?? 0],
    ["Published Activities", summary?.publishedActivities ?? 0],
    ["Likes", summary?.totalLikes ?? 0],
    ["Comments", summary?.totalComments ?? 0],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Corpus Collection
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage Liwan cultural submissions, activities, AI review, and public display.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((item) => (
          <div key={item.href} className="rounded-lg border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={item.href}>Manage</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
