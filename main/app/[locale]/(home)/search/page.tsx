/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEntrySearchQuery,
  useSearchQuery,
  useSearch,
  type SearchResult,
} from "@/lib/api/search";
import { toast } from "sonner";
import {
  Search,
  SearchX,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";
import { DictionaryNote } from "@/lib/types";
import { useAllCategories } from "@/lib/api/category";
import { useHotTerms } from "@/lib/api/public";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import SearchResultItem from "../_components/search-result-item";
import CategoryTabs from "../_components/category-tabs";
import { EntrySearchSections } from "../_components/entry-search-sections";
import { SearchHeader } from "@/components/layout/search-header";
import { MinimalFooter } from "../_components/minimal-footer";

// Type guard for dictionary note
function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  return !Array.isArray(note) && "context" in note;
}

export default function SearchPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const router = useRouter();
  const searchParams = useSearchParams();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<SearchResult | null>(null);
  const [selectCategory, setSelectCategory] = useState<string>("全部");
  const [tabsHidden, setTabsHidden] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Search");
  const th = useTranslations("Home");

  // 直接从 URL 读取搜索参数，驱动 useSearchQuery
  const urlKeyword = searchParams.get("q") || "";
  const urlDataset = searchParams.get("dataset") || "";
  const useEntryMode = searchParams.get("mode") === "entry";
  const datasetName = urlDataset ? urlDataset.split(",").filter(Boolean) : [];
  const categoryParam = JSON.stringify(datasetName.length ? datasetName : ["all"]);
  const [similarCursor, setSimilarCursor] = useState<string | null>(null);
  const [recommendedCursor, setRecommendedCursor] = useState<string | null>(null);

  // 用 useQuery 替代 useMutation，同样关键词命中缓存直接返回，无需重新请求
  const { data: results, isPending, error: searchError } = useSearchQuery(
    urlKeyword,
    categoryParam,
    !!urlKeyword && !useEntryMode,
  );
  const {
    data: entryResult,
    isPending: entryPending,
    isFetching: entryFetching,
    error: entrySearchError,
  } = useEntrySearchQuery(urlKeyword, {
    similarCursor,
    recommendedCursor,
    enabled: !!urlKeyword && useEntryMode,
  });
  const searchPending = useEntryMode ? entryPending : isPending;

  // 搜索参数同步到 UI state（用于 SearchHeader 显示）
  const [searchPrompt, setSearchPrompt] = useState(urlKeyword);
  const [selectedDataset, setSelectedDataset] = useState<string[]>(
    datasetName.length ? datasetName : ["all"]
  );

  // URL 变化时同步 UI state 并重置分页
  useEffect(() => {
    if (!urlKeyword) { router.push("/"); return; }
    setSearchPrompt(urlKeyword);
    setSelectedDataset(datasetName.length ? datasetName : ["all"]);
    setCurrentPage(1);
    setSelectCategory("全部");
    setSimilarCursor(null);
    setRecommendedCursor(null);
  }, [urlKeyword, urlDataset, useEntryMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchError) toast.error(t("searchFailed"), { description: (searchError as Error).message });
  }, [searchError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (entrySearchError) toast.error(t("searchFailed"), { description: (entrySearchError as Error).message });
  }, [entrySearchError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available categories
  const { data: categories } = useAllCategories();
  const { data: hotTerms, isLoading: hotTermsLoading } = useHotTerms();
  const globalSearchLabel = th("globalSearch");
  const fiter_not_in = useMemo(() => [
    { id: "all", name: "all", nickname: globalSearchLabel },
    ...(categories || []).filter((cat) => cat.if_in_all_data),
  ], [categories, globalSearchLabel]);

  // Observe category tabs to trigger header shadow only when tabs are hidden behind header
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTabsHidden(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [results]);

  const buildDatasetParam = () =>
    fiter_not_in
      .map((cat) => (selectedDataset.includes(cat.name) ? cat.name : null))
      .filter(Boolean)
      .join(",");

  const handleSearch = () => {
    if (!searchPrompt.trim()) return;
    setCurrentPage(1);
    setSelectCategory("全部");
    const params = new URLSearchParams();
    params.set("q", searchPrompt.trim());
    params.set("dataset", buildDatasetParam());
    if (useEntryMode) params.set("mode", "entry");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  /** For dropdown selection — receives term directly, avoids stale closure issue */
  const handleSearchWithTerm = (term: string) => {
    setSearchPrompt(term);
    setCurrentPage(1);
    setSelectCategory("全部");
    const params = new URLSearchParams();
    params.set("q", term.trim());
    params.set("dataset", buildDatasetParam());
    if (useEntryMode) params.set("mode", "entry");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  // Example search click handler -- navigates to /search
  const handleExampleSearch = (prompt: string) => {
    setSearchPrompt(prompt);
    setCurrentPage(1);
    setSelectCategory("全部");

    const params = new URLSearchParams();
    params.set("q", prompt);
    params.set("dataset", "all");
    if (useEntryMode) params.set("mode", "entry");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const handleToggleSearchMode = () => {
    if (!urlKeyword.trim()) return;
    setCurrentPage(1);
    setSelectCategory("全部");
    setSimilarCursor(null);
    setRecommendedCursor(null);

    const params = new URLSearchParams();
    params.set("q", urlKeyword.trim());
    if (urlDataset) params.set("dataset", urlDataset);
    if (!useEntryMode) params.set("mode", "entry");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  // 在渲染层把原始 category name 映射为 nickname，不在 mutation 里 await
  const enrichedResults = useMemo(() => {
    if (!results || !categories) return results;
    const categoryMap = new Map(categories.map((c) => [c.name, c]));
    return results.map((result) => {
      const info = categoryMap.get(result.category);
      return {
        ...result,
        category: info?.nickname || result.category,
        editable_level: info?.editable_level ?? 0,
        category_name: result.category,
      };
    });
  }, [results, categories]);

  const filteredResults = useMemo(() => {
    if (!enrichedResults) return [];
    return enrichedResults.filter(
      (result) =>
        selectCategory === "全部" || result.category === selectCategory,
    );
  }, [enrichedResults, selectCategory]);

  const totalPages = Math.ceil((filteredResults?.length || 0) / itemsPerPage);
  const currentResults =
    filteredResults?.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ) || [];

  // Helper function to generate page numbers with ellipsis
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = 4;
    } else if (currentPage >= totalPages - 2) {
      startPage = totalPages - 3;
    }

    if (startPage > 2) {
      pages.push("...");
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Top spacer that disappears on scroll ─────────────────────── */}
      <div className="h-4" />

      {/* ── Sticky search header ─────────────────────────────────────── */}
      <SearchHeader
        searchPrompt={searchPrompt}
        onSearchPromptChange={setSearchPrompt}
        onSearch={handleSearch}
        onSearchTerm={handleSearchWithTerm}
        isPending={searchPending}
        selectedDataset={selectedDataset}
        onDatasetChange={setSelectedDataset}
        categories={fiter_not_in}
        searchPlaceholder={th("searchPlaceholder")}
        searchButtonLabel={th("searchButton")}
        searchingLabel={t("searching")}
        shadowActive={enrichedResults && enrichedResults.length > 0 ? tabsHidden : undefined}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {urlKeyword && (
          <div className="px-4 pt-3">
            <div className="hidden sm:flex">
              <div className="shrink-0 w-[172px]" />
              <div className="flex-1 max-w-3xl">
                <button
                  type="button"
                  onClick={handleToggleSearchMode}
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {useEntryMode ? "切换到旧搜索" : "切换到新搜索"}
                </button>
              </div>
            </div>
            <div className="sm:hidden">
              <button
                type="button"
                onClick={handleToggleSearchMode}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {useEntryMode ? "切换到旧搜索" : "切换到新搜索"}
              </button>
            </div>
          </div>
        )}

        {/* ── Category tabs ────────────────────────────────────────────── */}
        {enrichedResults && enrichedResults.length > 0 && !useEntryMode && (
          <div ref={tabsRef}>
            <CategoryTabs
              results={enrichedResults}
              selectedCategory={selectCategory}
              onSelect={(cat) => {
                setSelectCategory(cat);
                setCurrentPage(1);
              }}
              selectedDataset={selectedDataset}
            />
          </div>
        )}

        {/* ── Loading skeletons：仅首次加载（无旧结果时）显示 ──────────── */}
        {searchPending && !results && !entryResult && (
          <div className="px-4 py-6">
            {/* Desktop/Tablet: Align with search bar */}
            <div className="hidden sm:flex">
              <div className="shrink-0 w-[172px]">{/* Spacer */}</div>
              <div className="flex-1 max-w-3xl">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="py-5 border-b border-border">
                    <Skeleton className="h-5 w-2/5 mb-2" />
                    <Skeleton className="h-4 w-full mb-1.5" />
                    <Skeleton className="h-4 w-4/5 mb-3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded" />
                      <Skeleton className="h-5 w-14 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: Full width */}
            <div className="sm:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="py-5 border-b border-border">
                  <Skeleton className="h-5 w-2/5 mb-2" />
                  <Skeleton className="h-4 w-full mb-1.5" />
                  <Skeleton className="h-4 w-4/5 mb-3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-14 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results：重新搜索时保留旧结果并降低透明度 ────────────────── */}
        {useEntryMode && entryResult && (
          <div
            className={cn(
              "px-4 py-4 transition-opacity duration-200",
              entryFetching && "opacity-60 pointer-events-none",
            )}
          >
            <div className="hidden sm:flex">
              <div className="shrink-0 w-[172px]">{/* Spacer */}</div>
              <div className="flex-1 max-w-3xl">
                <EntrySearchSections
                  result={entryResult}
                  isRefreshingSimilar={entryFetching}
                  isRefreshingRecommended={entryFetching}
                  onRefreshSimilar={() =>
                    setSimilarCursor(entryResult.cursors.similarNext)
                  }
                  onRefreshRecommended={() =>
                    setRecommendedCursor(entryResult.cursors.recommendedNext)
                  }
                />
              </div>
            </div>
            <div className="sm:hidden">
              <EntrySearchSections
                result={entryResult}
                isRefreshingSimilar={entryFetching}
                isRefreshingRecommended={entryFetching}
                onRefreshSimilar={() =>
                  setSimilarCursor(entryResult.cursors.similarNext)
                }
                onRefreshRecommended={() =>
                  setRecommendedCursor(entryResult.cursors.recommendedNext)
                }
              />
            </div>
          </div>
        )}

        {enrichedResults && enrichedResults.length > 0 && !useEntryMode && (
          <div
            className={cn(
              "px-4 py-4 transition-opacity duration-200",
              isPending && "opacity-40 pointer-events-none",
            )}
          >
            {/* Desktop/Tablet: Align with search bar */}
            <div className="hidden sm:flex">
              <div className="shrink-0 w-[172px]">{/* Spacer */}</div>
              <div className="flex-1 max-w-3xl">
                {/* Result count */}
                <p className="text-sm text-muted-foreground mb-1">
                  {t("resultCount", { count: filteredResults.length })}
                </p>

                {/* Result items */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectCategory}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {currentResults.map((result, index) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          delay: index * 0.06,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <SearchResultItem
                          result={result}
                          setEditingResult={setEditingResult}
                          setUpdateDialogOpen={setUpdateDialogOpen}
                          keyword={searchPrompt}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* ── Hot searches ──────────────────────────────────────────── */}
                <div className="mt-10">
                  <p className="text-sm text-muted-foreground mb-3">
                    {th("trending")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hotTermsLoading
                      ? [20, 24, 16, 28, 20, 24].map((w, i) => (
                          <Skeleton
                            key={i}
                            className={`h-9 w-${w} rounded-lg`}
                          />
                        ))
                      : (hotTerms ?? [])
                          .filter((term) => term !== searchPrompt)
                          .map((term) => (
                            <button
                              key={term}
                              onClick={() => {
                                if (isPending) return;
                                handleExampleSearch(term);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                            >
                              <Search className="h-3.5 w-3.5 text-muted-foreground" />
                              {term}
                            </button>
                          ))}
                  </div>
                </div>

                {/* ── Pagination ────────────────────────────────────────────── */}
                {totalPages > 1 && (
                  <div className="flex justify-start items-center gap-1 mt-8">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="size-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="size-9 flex items-center justify-center text-muted-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={cn(
                            "relative size-9 flex items-center justify-center rounded-md text-sm transition-colors",
                            currentPage === page
                              ? "text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {currentPage === page && (
                            <motion.span
                              layoutId="page-bubble-desktop"
                              className="absolute inset-0 bg-primary rounded-md"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 30,
                              }}
                            />
                          )}
                          <span className="relative z-10 font-medium">
                            {page}
                          </span>
                        </button>
                      ),
                    )}

                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="size-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Full width */}
            <div className="sm:hidden">
              {/* Result count */}
              <p className="text-sm text-muted-foreground mb-1">
                {t("resultCount", { count: filteredResults.length })}
              </p>

              {/* Result items */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectCategory}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentResults.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <SearchResultItem
                        result={result}
                        setEditingResult={setEditingResult}
                        setUpdateDialogOpen={setUpdateDialogOpen}
                        keyword={searchPrompt}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* ── Hot searches ──────────────────────────────────────────── */}
              <div className="mt-10">
                <p className="text-sm text-muted-foreground mb-3">
                  {th("trending")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {hotTermsLoading
                    ? [20, 24, 16, 28, 20, 24].map((w, i) => (
                        <Skeleton key={i} className={`h-9 w-${w} rounded-lg`} />
                      ))
                    : (hotTerms ?? [])
                        .filter((term) => term !== searchPrompt)
                        .map((term) => (
                          <button
                            key={term}
                            onClick={() => {
                              if (isPending) return;
                              handleExampleSearch(term);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                          >
                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                            {term}
                          </button>
                        ))}
                </div>
              </div>

              {/* ── Pagination ────────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1 mt-8">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="size-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {getPageNumbers().map((page, idx) =>
                    page === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="size-9 flex items-center justify-center text-muted-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={cn(
                          "relative size-9 flex items-center justify-center rounded-md text-sm transition-colors",
                          currentPage === page
                            ? "text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {currentPage === page && (
                          <motion.span
                            layoutId="page-bubble-mobile"
                            className="absolute inset-0 bg-primary rounded-md"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className="relative z-10 font-medium">
                          {page}
                        </span>
                      </button>
                    ),
                  )}

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="size-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── No results ───────────────────────────────────────────────── */}
        {enrichedResults && enrichedResults.length === 0 && !isPending && !useEntryMode && (
          <div className="flex-1 flex flex-col justify-center px-4 pb-32">
            {/* Desktop/Tablet: Align with search bar */}
            <div className="hidden sm:flex">
              <div className="shrink-0 w-[172px]">{/* Spacer */}</div>
              <div className="flex-1 max-w-3xl flex flex-col gap-8">
                <div className="flex items-center gap-3">
                  <SearchX className="h-7 w-7 text-muted-foreground shrink-0" />
                  <div className="space-y-0.5">
                    <h3 className="text-base font-semibold text-foreground">
                      {t("noResultsTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("noResultsDesc", { query: searchPrompt })}
                    </p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t("noResultsTip1")}</li>
                  <li>• {t("noResultsTip2")}</li>
                </ul>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {th("trending")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { title: t("exampleLyrics"), prompt: "落花流水" },
                      { title: t("exampleWords"), prompt: "姐姐" },
                      { title: t("exampleCharacter"), prompt: "行" },
                      { title: t("exampleVideo"), prompt: "歡聚一堂" },
                    ]
                      .filter((e) => e.prompt !== searchPrompt)
                      .map((example) => (
                        <button
                          key={example.prompt}
                          onClick={() => {
                            if (isPending) return;
                            handleExampleSearch(example.prompt);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                        >
                          <Search className="h-3.5 w-3.5 text-muted-foreground" />
                          {example.title}「{example.prompt}」
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Full width left-aligned */}
            <div className="sm:hidden flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <SearchX className="h-7 w-7 text-muted-foreground shrink-0" />
                <div className="space-y-0.5">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("noResultsTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("noResultsDesc", { query: searchPrompt })}
                  </p>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t("noResultsTip1")}</li>
                <li>• {t("noResultsTip2")}</li>
              </ul>
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {th("trending")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {hotTermsLoading
                    ? [20, 24, 16, 28, 20, 24].map((w, i) => (
                        <Skeleton key={i} className={`h-9 w-${w} rounded-lg`} />
                      ))
                    : (hotTerms ?? [])
                        .filter((term) => term !== searchPrompt)
                        .map((term) => (
                          <button
                            key={term}
                            onClick={() => {
                              if (isPending) return;
                              handleExampleSearch(term);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                          >
                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                            {term}
                          </button>
                        ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit dialog ──────────────────────────────────────────────── */}
        <EditCorpusDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          editingResult={editingResult}
        />
      </div>
      {/* end flex-1 */}

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <MinimalFooter />
    </div>
  );
}
