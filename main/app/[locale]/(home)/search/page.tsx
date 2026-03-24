/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { toast } from "sonner";
import { Search, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";
import { DictionaryNote } from "@/lib/types";
import { useAllCategories } from "@/lib/api/category";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import SearchResultItem from "../_components/search-result-item";
import CategoryTabs from "../_components/category-tabs";
import { SearchHeader } from "@/components/layout/search-header";

// Type guard for dictionary note
function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  return !Array.isArray(note) && "context" in note;
}

export default function SearchPage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { mutate: search, isPending } = useSearch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<SearchResult | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string[]>(["all"]);
  const [selectCategory, setSelectCategory] = useState<string>("全部");
  const t = useTranslations("Search");
  const th = useTranslations("Home"); // used for searchPlaceholder + searchButton passed to SearchHeader

  // Fetch available categories
  const { data: categories, isLoading: categoriesLoading } = useAllCategories();
  const fiter_not_in = [
    { id: "all", name: "all", nickname: "全局搜索" },
    ...(categories || [])?.filter((cat) => cat.if_in_all_data),
  ];

  // Read search params from URL -- redirect to home if no query
  useEffect(() => {
    const keyword = searchParams.get("q") || "";
    const datasetParam = searchParams.get("dataset") || "";

    // No query param → redirect back to homepage
    if (!keyword) {
      router.push("/");
      return;
    }

    const datasetName = fiter_not_in
      .map((cat) =>
        datasetParam.split(",").includes(cat.nickname ?? cat.name)
          ? cat.name
          : null
      )
      .filter(Boolean) as string[];

    // Sync UI state
    setSearchPrompt(keyword);
    setSelectedDataset(datasetName.length ? datasetName : ["all"]);
    setCurrentPage(1);

    // Search using URL values directly (not state)
    search(
      {
        keyword,
        category: JSON.stringify(datasetName.length ? datasetName : ["all"]),
      },
      {
        onSuccess: setResults,
        onError: (error: Error) => {
          toast.error(t("searchFailed"), { description: error.message });
        },
      }
    );
  }, [searchParams, JSON.stringify(fiter_not_in)]);

  const handleSearch = () => {
    if (!searchPrompt.trim()) return;
    setCurrentPage(1);
    setSelectCategory("全部");

    const dataset = fiter_not_in
      .map((cat) => {
        if (selectedDataset.includes(cat.name)) {
          return cat.nickname ?? cat.name;
        }
        return null;
      })
      .filter(Boolean);

    // Update URL params -- navigate within /search
    const params = new URLSearchParams();
    params.set("q", searchPrompt.trim());
    params.set("dataset", dataset.join(","));
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  // Example search click handler -- navigates to /search
  const handleExampleSearch = (prompt: string) => {
    setSearchPrompt(prompt);
    setCurrentPage(1);
    setSelectCategory("全部");

    const params = new URLSearchParams();
    params.set("q", prompt);
    params.set("dataset", "全局搜索");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter((result) => selectCategory === "全部" || result.category === selectCategory);
  }, [results, selectCategory]);

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
      pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      pages.push('...');
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <>
      {/* ── Sticky search header ─────────────────────────────────────── */}
      <SearchHeader
        searchPrompt={searchPrompt}
        onSearchPromptChange={setSearchPrompt}
        onSearch={handleSearch}
        isPending={isPending}
        selectedDataset={selectedDataset}
        onDatasetChange={setSelectedDataset}
        categories={fiter_not_in}
        searchPlaceholder={th("searchPlaceholder")}
        searchButtonLabel={th("searchButton")}
        searchingLabel={t("searching")}
      />

      {/* ── Category tabs ────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <CategoryTabs
          results={results}
          selectedCategory={selectCategory}
          onSelect={(cat) => {
            setSelectCategory(cat);
            setCurrentPage(1);
          }}
          selectedDataset={selectedDataset}
        />
      )}

      {/* ── Loading skeletons ─────────────────────────────────────────── */}
      {isPending && (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
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
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div className="container mx-auto px-4 py-4 max-w-4xl">
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
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* ── Pagination ────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 mt-8 text-sm">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("prevPage")}
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1.5 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={cn(
                      "px-3 py-1.5 rounded transition-colors",
                      currentPage === page
                        ? "font-bold text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("nextPage")}
              </button>
            </div>
          )}

          {/* ── Try other searches ────────────────────────────────────── */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">{t("tryOtherSearches")}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
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
                      setResults(null);
                      handleExampleSearch(example.prompt);
                    }}
                    className="text-primary hover:underline"
                  >
                    {example.title}「{example.prompt}」
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── No results ───────────────────────────────────────────────── */}
      {results && results.length === 0 && (
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="flex flex-col items-center text-center gap-4">
            <SearchX className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-foreground">
                {t("noResultsTitle")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {t("noResultsDesc", { query: searchPrompt })}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-sm">
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
                      setResults(null);
                      handleExampleSearch(example.prompt);
                    }}
                    className="text-primary hover:underline"
                  >
                    {example.title}「{example.prompt}」
                  </button>
                ))}
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
    </>
  );
}
