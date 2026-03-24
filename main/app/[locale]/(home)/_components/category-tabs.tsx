"use client";

import { cn } from "@/lib/utils";
import { type SearchResult } from "@/lib/api/search";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface CategoryTabsProps {
  results: SearchResult[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  selectedDataset: string[];
}

export default function CategoryTabs({
  results,
  selectedCategory,
  onSelect,
  selectedDataset,
}: CategoryTabsProps) {
  const t = useTranslations("Search");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    results?.forEach((r) => {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    });
    return [...map.entries()];
  }, [results]);

  // Same visibility condition as the old CategorySelector
  if (!(selectedDataset.length > 1 || selectedDataset[0] === "all")) {
    return null;
  }

  const tabs = [
    { label: t("allCategories"), value: "全部", count: results.length },
    ...categories.map(([cat, count]) => ({ label: cat, value: cat, count })),
  ];

  return (
    <div className="border-b border-border bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onSelect(tab.value)}
              className={cn(
                "shrink-0 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors duration-150",
                selectedCategory === tab.value
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span className="ml-1 text-xs opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
