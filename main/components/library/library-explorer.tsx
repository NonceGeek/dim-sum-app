"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DATASET_ACCESS_MODES,
  DATASET_MODALITIES,
  DATASET_QUALITY_FLAGS,
  DATASET_SORTS,
  DATASET_USE_CASES,
  DatasetSort,
} from "@/lib/library/options";
import type { PublicDataset } from "@/lib/library/public-datasets";
import {
  DatasetCard,
  DatasetListHeader,
  DatasetListRow,
} from "./dataset-card";
import { ShareCardDialog } from "./share-card-dialog";
import { ContributionForm } from "./contribution-form";

type Filters = {
  modalities: string[];
  use_cases: string[];
  access_modes: string[];
  quality_flags: string[];
};
type FilterKey = keyof Filters;

const GROUPS: Array<{ key: FilterKey; label: string; values: readonly string[]; option: string }> = [
  { key: "modalities", label: "modalities", values: DATASET_MODALITIES, option: "modality" },
  { key: "use_cases", label: "useCases", values: DATASET_USE_CASES, option: "useCase" },
  { key: "access_modes", label: "accessModes", values: DATASET_ACCESS_MODES, option: "access" },
  { key: "quality_flags", label: "quality", values: DATASET_QUALITY_FLAGS, option: "quality" },
];

/** Text chips fill the search box; condition chips toggle a filter. */
const HOT_CHIPS: Array<
  { key: string } & ({ query: string } | { filter: FilterKey; value: string })
> = [
  { key: "asr", filter: "use_cases", value: "asr_tts" },
  { key: "safety", filter: "use_cases", value: "safety_eval" },
  { key: "hk", query: "香港" },
  { key: "metadataOnly", filter: "access_modes", value: "metadata_only" },
  { key: "multimodal", filter: "modalities", value: "multimodal" },
];

const PAGE = 24;
const EMPTY: Filters = { modalities: [], use_cases: [], access_modes: [], quality_flags: [] };

function readFilters(params: URLSearchParams): Filters {
  const get = (key: FilterKey, allowed: readonly string[]) =>
    (params.get(key) ?? "").split(",").filter((v) => allowed.includes(v));
  return {
    modalities: get("modalities", DATASET_MODALITIES),
    use_cases: get("use_cases", DATASET_USE_CASES),
    access_modes: get("access_modes", DATASET_ACCESS_MODES),
    quality_flags: get("quality_flags", DATASET_QUALITY_FLAGS),
  };
}

function apiParams(q: string, filters: Filters, sort: string, pageSize: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  for (const [key, values] of Object.entries(filters))
    if (values.length) params.set(key, values.join(","));
  params.set("sort", sort);
  params.set("page_size", String(pageSize));
  return params;
}

async function fetchDatasets(params: URLSearchParams) {
  const res = await fetch(`/api/public/datasets?${params}`);
  if (!res.ok) throw new Error("load failed");
  return (await res.json()) as { items: PublicDataset[]; total: number };
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function FilterGroups({
  filters,
  onToggle,
}: {
  filters: Filters;
  onToggle: (key: FilterKey, value: string) => void;
}) {
  const t = useTranslations("Library");
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <fieldset key={group.key} className="space-y-2">
          <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium">
            {t(`groups.${group.label}`)}
            <span className="text-xs font-normal text-muted-foreground">{t("explorer.multi")}</span>
          </legend>
          {group.values.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={filters[group.key].includes(value)}
                onCheckedChange={() => onToggle(group.key, value)}
              />
              {t(`options.${group.option}.${value}`)}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export function LibraryExplorer() {
  const t = useTranslations("Library");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Old links used ?category=<tag>; treat it as a search term.
  const initialQ = searchParams.get("q") ?? searchParams.get("category") ?? "";
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebounced(q.trim(), 400);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const sortParam = searchParams.get("sort");
  const sort: DatasetSort = DATASET_SORTS.includes(sortParam as DatasetSort)
    ? (sortParam as DatasetSort)
    : "relevance";
  const view = searchParams.get("view") === "list" ? "list" : "card";
  const [pages, setPages] = useState(1);
  const [shareTarget, setShareTarget] = useState<PublicDataset | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeDone, setContributeDone] = useState(false);
  const [mobileFilters, setMobileFilters] = useState<Filters | null>(null);
  const [sortSheet, setSortSheet] = useState(false);

  const updateUrl = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    for (const [key, value] of Object.entries(patch))
      if (value) params.set(key, value);
      else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (debouncedQ !== (searchParams.get("q") ?? "")) updateUrl({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  useEffect(() => setPages(1), [debouncedQ, filters, sort]);

  const setFilters = (next: Filters) =>
    updateUrl(
      Object.fromEntries(
        Object.entries(next).map(([k, v]) => [k, v.length ? v.join(",") : null]),
      ),
    );
  const toggle = (current: Filters, key: FilterKey, value: string): Filters => ({
    ...current,
    [key]: current[key].includes(value)
      ? current[key].filter((v) => v !== value)
      : [...current[key], value],
  });

  const query = useQuery({
    queryKey: ["library-datasets", debouncedQ, filters, sort, pages],
    queryFn: () => fetchDatasets(apiParams(debouncedQ, filters, sort, Math.min(PAGE * pages, 100))),
    placeholderData: keepPreviousData,
  });
  // Live result count for the mobile full-screen filter footer.
  const draftCount = useQuery({
    queryKey: ["library-datasets-count", debouncedQ, mobileFilters, sort],
    queryFn: () => fetchDatasets(apiParams(debouncedQ, mobileFilters ?? EMPTY, sort, 1)),
    enabled: !!mobileFilters,
    placeholderData: keepPreviousData,
  });

  const activeLabels = [
    debouncedQ && `“${debouncedQ}”`,
    ...GROUPS.flatMap((g) => filters[g.key].map((v) => t(`options.${g.option}.${v}`))),
  ].filter(Boolean) as string[];
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const clearAll = () => {
    setQ("");
    updateUrl({ q: null, modalities: null, use_cases: null, access_modes: null, quality_flags: null });
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("explorer.breadcrumb")}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("explorer.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("explorer.subtitle")}</p>
        </div>
        <Button className="hidden sm:inline-flex" onClick={() => setContributeOpen(true)}>
          <Plus /> {t("explorer.contribute")}
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("explorer.searchPlaceholder")}
          className="h-11 pl-9 pr-9"
          maxLength={100}
          aria-label={t("explorer.searchPlaceholder")}
        />
        {q && (
          <button
            type="button"
            aria-label={t("explorer.clear")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => setQ("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("explorer.hotLabel")}</span>
        {HOT_CHIPS.map((chip) => {
          const active =
            "query" in chip ? debouncedQ === chip.query : filters[chip.filter].includes(chip.value);
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
              onClick={() =>
                "query" in chip
                  ? setQ(active ? "" : chip.query)
                  : setFilters(toggle(filters, chip.filter, chip.value))
              }
            >
              {t(`hot.${chip.key}`)}
            </button>
          );
        })}
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t("explorer.filterTitle")}</h2>
              <button type="button" className="text-sm text-primary" onClick={clearAll}>
                {t("explorer.clearAll")}
              </button>
            </div>
            <FilterGroups filters={filters} onToggle={(k, v) => setFilters(toggle(filters, k, v))} />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" aria-live="polite">
              <b>{t("explorer.resultCount", { count: total })}</b>
              <span className="text-muted-foreground">
                {" · "}
                {activeLabels.length
                  ? t("explorer.applied", { items: activeLabels.join("、") })
                  : t("explorer.allResults")}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileFilters(filters)}
              >
                <SlidersHorizontal /> {t("explorer.filters")}
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden" onClick={() => setSortSheet(true)}>
                {t(`options.sort.${sort}`)} ▾
              </Button>
              <div className="hidden sm:block">
                <Select value={sort} onValueChange={(v) => updateUrl({ sort: v === "relevance" ? null : v })}>
                  <SelectTrigger className="h-8 w-40" aria-label={t("explorer.sortLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATASET_SORTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t("explorer.sortOption", { label: t(`options.sort.${s}`) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex rounded-md border p-0.5" role="group">
                {(["card", "list"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={view === v}
                    aria-label={t(v === "card" ? "explorer.cardView" : "explorer.listView")}
                    onClick={() => updateUrl({ view: v === "card" ? null : v })}
                  >
                    {v === "card" ? <LayoutGrid /> : <List />}
                    <span className="hidden md:inline">
                      {t(v === "card" ? "explorer.cardView" : "explorer.listView")}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {query.isError ? (
            <div className="rounded-xl border p-10 text-center">
              <p className="mb-3">{t("explorer.loadError")}</p>
              <Button variant="outline" onClick={() => query.refetch()}>{t("explorer.retry")}</Button>
            </div>
          ) : query.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : !items.length ? (
            <div className="rounded-xl border p-10 text-center">
              <p className="font-medium">{t("explorer.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("explorer.emptyHint")}</p>
            </div>
          ) : view === "card" ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((d) => (
                <DatasetCard key={d.slug} dataset={d} onShare={setShareTarget} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <DatasetListHeader />
              {items.map((d) => (
                <DatasetListRow key={d.slug} dataset={d} onShare={setShareTarget} />
              ))}
            </div>
          )}
          {items.length < total && items.length < 100 && (
            <div className="mt-6 text-center">
              <Button variant="outline" disabled={query.isFetching} onClick={() => setPages((p) => p + 1)}>
                {t("explorer.loadMore")}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Mobile: full-screen filter page with fixed footer. */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden" role="dialog" aria-modal="true">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <button type="button" aria-label={t("explorer.cancel")} onClick={() => setMobileFilters(null)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-medium">{t("explorer.filterTitle")}</h2>
            <button type="button" className="text-sm text-primary" onClick={() => setMobileFilters(EMPTY)}>
              {t("explorer.clear")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <FilterGroups
              filters={mobileFilters}
              onToggle={(k, v) => setMobileFilters(toggle(mobileFilters, k, v))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setMobileFilters(null)}>
              {t("explorer.cancel")}
            </Button>
            <Button
              onClick={() => {
                setFilters(mobileFilters);
                setMobileFilters(null);
              }}
            >
              {t("explorer.showResults", { count: draftCount.data?.total ?? total })}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={sortSheet} onOpenChange={setSortSheet}>
        <SheetContent side="bottom" className="rounded-t-xl sm:hidden">
          <SheetHeader>
            <SheetTitle>{t("explorer.sortLabel")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {DATASET_SORTS.map((s) => (
              <button
                key={s}
                type="button"
                className="flex w-full items-center justify-between border-b py-3 text-left last:border-b-0"
                onClick={() => {
                  updateUrl({ sort: s === "relevance" ? null : s });
                  setSortSheet(false);
                }}
              >
                {t(`options.sort.${s}`)}
                {sort === s && <span className="text-primary">✓</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={contributeOpen}
        onOpenChange={(open) => {
          setContributeOpen(open);
          if (!open) setContributeDone(false);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>
              {t(contributeDone ? "contribute.submittedTitle" : "contribute.title")}
            </SheetTitle>
          </SheetHeader>
          <ContributionForm
            onClose={() => {
              setContributeOpen(false);
              setContributeDone(false);
            }}
            onSubmittedChange={setContributeDone}
          />
        </SheetContent>
      </Sheet>

      <ShareCardDialog dataset={shareTarget} onOpenChange={(open) => !open && setShareTarget(null)} />

    </div>
  );
}
