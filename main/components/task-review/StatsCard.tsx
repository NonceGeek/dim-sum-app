"use client";

import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface StatsCardProps {
  totalCorpusCount: number | null;
  totalCount: number;
  processedCount: number;
  unprocessedCount: number;
  completionRate: number;
}

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function getRateColor(rate: number) {
  if (rate > 0.75) return "text-green-600 dark:text-green-400";
  if (rate > 0.5) return "text-orange-500 dark:text-orange-400";
  if (rate > 0.25) return "text-yellow-500 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
}

export function StatsCard({
  totalCorpusCount,
  totalCount,
  processedCount,
  unprocessedCount,
  completionRate,
}: StatsCardProps) {
  const t = useTranslations("TaskReview");

  const items = [
    { label: t("totalCorpusCount"), value: totalCorpusCount ?? "—" },
    { label: t("totalTaskCount"), value: totalCount },
    { label: t("processedCount"), value: processedCount },
    { label: t("unprocessedCount"), value: unprocessedCount },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">{t("summary")}</h3>
        <span className={`text-lg font-bold ${getRateColor(completionRate)}`}>
          {formatPercent(completionRate)}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-lg font-semibold">{item.value}</div>
            <div className="text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export { getRateColor, formatPercent };
