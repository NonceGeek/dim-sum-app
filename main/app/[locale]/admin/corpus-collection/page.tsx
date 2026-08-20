"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

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

export default function CorpusCollectionAdminPage() {
  const t = useTranslations("CorpusCollectionOverview");
  const modules = [
    { title: t("modules.activities.title"), description: t("modules.activities.description"), href: "/admin/corpus-collection/activities" },
    { title: t("modules.submissions.title"), description: t("modules.submissions.description"), href: "/admin/corpus-collection/submissions" },
    { title: t("modules.categories.title"), description: t("modules.categories.description"), href: "/admin/corpus-collection/categories" },
    { title: t("modules.reviewBatches.title"), description: t("modules.reviewBatches.description"), href: "/admin/corpus-collection/review-batches" },
    { title: t("modules.analytics.title"), description: t("modules.analytics.description"), href: "/admin/corpus-collection/analytics" },
  ];
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/corpus-collection/analytics/summary")
      .then((response) => (response.ok ? response.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const stats = [
    [t("stats.totalSubmissions"), summary?.totalSubmissions ?? 0],
    [t("stats.pendingReview"), summary?.pendingSubmissions ?? 0],
    [t("stats.approved"), summary?.approvedSubmissions ?? 0],
    [t("stats.rejected"), summary?.rejectedSubmissions ?? 0],
    [t("stats.activities"), summary?.totalActivities ?? 0],
    [t("stats.publishedActivities"), summary?.publishedActivities ?? 0],
    [t("stats.likes"), summary?.totalLikes ?? 0],
    [t("stats.comments"), summary?.totalComments ?? 0],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Corpus Collection
        </h2>
        <p className="text-muted-foreground mt-2">
          {t("description")}
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
              <Link href={item.href}>{t("manage")}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
