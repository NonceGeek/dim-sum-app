/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { toast } from "sonner";
import { Search, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";
import { DictionaryNote } from "@/lib/types";
import WordLyricCardDetail from "./_components/word-lyric-card-detail";
import YueSongCardDetail from "./_components/yue-song-card-detail";
import { useAllCategories } from "@/lib/api/category";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import CategorySelector from "./_components/category-selector";

// Type guard for dictionary note
function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  return !Array.isArray(note) && "context" in note;
}


export default function HomePage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { mutate: search, isPending } = useSearch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<SearchResult | null>(null);
  // const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<string[]>(["all"]);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectCategory, setSelectCategory] = useState<string>("全部");

  // Fetch available categories
  // get all categories from the backend
  const { data: categories, isLoading: categoriesLoading } = useAllCategories();
  const fiter_not_in = [
    { id: "all", name: "all", nickname: "全局搜索" },
    ...(categories || [])?.filter((cat) => cat.if_in_all_data),
  ];

  // 从URL参数读取搜索关键词
  useEffect(() => {
    const keyword = searchParams.get("q") || "";
    const datasetParam = searchParams.get("dataset") || "";

    // URL 是空的 → 回到首页
    if (!keyword && !datasetParam) {
      setSearchPrompt("");
      setSelectedDataset(["all"]);
      setResults(null);
      setCurrentPage(1);
      setSelectCategory("全部");
      return;
    }

    const datasetName = fiter_not_in
      .map((cat) =>
        datasetParam.split(",").includes(cat.nickname ?? cat.name)
          ? cat.name
          : null
      )
      .filter(Boolean) as string[];

    // 同步 UI 状态
    setSearchPrompt(keyword);
    setSelectedDataset(datasetName.length ? datasetName : ["all"]);
    setCurrentPage(1);

    // 用 URL 里的值直接搜索（不要用 state）
    search(
      {
        keyword,
        category: JSON.stringify(datasetName.length ? datasetName : ["all"]),
      },
      {
        onSuccess: setResults,
        onError: (error: Error) => {
          toast.error("Search failed", { description: error.message });
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

    // 更新URL参数
    const params = new URLSearchParams();
    params.set("q", searchPrompt.trim());
    params.set("dataset", dataset.join(","));
    router.push(`/?${params.toString()}`, { scroll: false });

  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // 更新示例搜索的点击处理函数
  const handleExampleSearch = (prompt: string) => {
    setSearchPrompt(prompt);
    setCurrentPage(1);
    setSelectCategory("全部");

    // 更新URL参数
    const params = new URLSearchParams();
    params.set("q", prompt);
    params.set("dataset", "全局搜索");
    router.push(`/?${params.toString()}`, { scroll: false });

  };

  // 返回首页函数
  const handleBackToHome = () => {
    router.push("/", { scroll: false });
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
    const showPages = 5; // Number of page buttons to show (excluding ellipsis)

    if (totalPages <= showPages) {
      // If total pages is small, show all
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust to ensure we always show enough pages
    if (currentPage <= 3) {
      endPage = 4;
    } else if (currentPage >= totalPages - 2) {
      startPage = totalPages - 3;
    }

    // Add ellipsis and middle pages
    if (startPage > 2) {
      pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page
    pages.push(totalPages);

    return pages;
  };

  return (
    <>
      {/* <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <Header showLogo />
      </div> */}
      <motion.div
        className="container mx-auto p-6 flex flex-col h-[calc(100vh-140px)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="flex flex-col items-center space-y-6 w-full h-full"
          initial={{ justifyContent: "center", opacity: 0, y: 20 }}
          animate={{
            justifyContent:
              results && results.length > 0 ? "flex-start" : "center",
            paddingTop: results && results.length > 0 ? "1rem" : "0",
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <motion.h1
            className="text-4xl font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent"
            initial={{ scale: 1, y: 0, opacity: 0 }}
            animate={{
              scale: results && results.length > 0 ? 0.8 : 1,
              y: results && results.length > 0 ? -20 : 0,
              opacity: 1,
            }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            Try Some Cantonese
          </motion.h1>

          <motion.div
            className="w-full max-w-2xl space-y-4"
            initial={{ width: "100%", y: 0, opacity: 0 }}
            animate={{
              width: results && results.length > 0 ? "80%" : "100%",
              y: results && results.length > 0 ? -20 : 0,
              opacity: 1,
            }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <motion.div
              className="flex gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  placeholder="Search Cantonese content..."
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="pl-10 h-12 text-lg dark:text-accent-foreground dark:placeholder:text-accent-foreground dark:bg-background"
                />
              </div>
              {/* Dataset selection dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[180px] justify-between truncate h-12 hover:bg-background! dark:bg-background dark:text-accent-foreground"
                  >
                    {(fiter_not_in || [])
                      ?.map((cat) => {
                        if (selectedDataset.includes(cat.name)) {
                          return cat.nickname || cat.name;
                        }
                        return null;
                      })
                      .filter(Boolean)
                      .join(", ") || "请选择"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command className="bg-background!">
                    <CommandInput
                      placeholder={"搜索数据集"}
                      value={inputValue}
                      onValueChange={setInputValue}
                    />
                    <CommandList>
                      {(fiter_not_in || [])?.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.nickname || cat.name}
                          onSelect={() => {
                            if (cat.name === "all") {
                              setSelectedDataset(["all"]);
                              return;
                            }
                            setSelectedDataset((prev) =>
                              (prev.includes(cat.name)
                                ? prev.filter((item) => item !== cat.name)
                                : [...prev, cat.name]
                              ).filter((item) => item !== "all")
                            );
                          }}
                        >
                          <Checkbox
                            className="mr-2 dark:bg-accent-background"
                            checked={selectedDataset.includes(cat.name)}
                            onChange={() => {
                              if (cat.name === "all") {
                                setSelectedDataset(["all"]);
                                return;
                              }
                              setSelectedDataset((prev) =>
                                (prev.includes(cat.name)
                                  ? prev.filter((item) => item !== cat.name)
                                  : [...prev, cat.name]
                                ).filter((item) => item !== "all")
                              );
                            }}
                            id={cat.id + ""}
                          />
                          {cat.nickname ?? cat.name}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleSearch}
                disabled={isPending}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6"
              >
                {isPending ? "Searching..." : "Search"}
              </Button>
              {/* TODO: impl in the future.
                <Button 
                onClick={() => router.push('/account/data-annotation')}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6 ml-2"
              >
                Add
              </Button> */}
            </motion.div>

            {/* Hint: Cleaned up homepage content - Search bar only */}

            {results === null && (
              <motion.div
                className="w-full max-w-2xl space-y-4 mb-20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("落花流水")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        Cantonese Lyrics
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        落花流水
                      </p>
                    </div>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("唔")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        News
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">唔听</p>
                    </div>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("行")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        Single Character
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">行</p>
                    </div>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("姐姐")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        Chinese Words
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">姐姐</p>
                    </div>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("歡聚一堂")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        Video Example
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        歡聚一堂
                      </p>
                    </div>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                    onClick={() => handleExampleSearch("帆船")}
                  >
                    <div className="text-center space-y-1 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                        3D Model
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">帆船</p>
                    </div>
                  </Card>
                </div>

                <p className="text-base text-center text-gray-500 underline">
                  <a href="https://www.aidimsum.com/zh#stats" target="_blank" rel="noopener noreferrer">
                  👉 查看数据情况 👈
                  </a>
                </p>
              </motion.div>
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {results === null && !isPending ? (
              <motion.div
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center items-center h-0"
              ></motion.div>
            ) : isPending ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center items-center h-32"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </motion.div>
            ) : results && results.length > 0 ? (
              <motion.div
                key="results"
                className="w-full max-w-4xl flex-1 overflow-y-auto px-2 pb-10 min-h-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CategorySelector
                  selectCategory={selectCategory}
                  setSelectCategory={setSelectCategory}
                  results={results}
                  selectedDataset={selectedDataset}
                />
                {currentResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.1,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {/* HINT: not delete, to render the result here. */}
                    {result.category !== "粤语曲库" && (
                        <WordLyricCardDetail
                          result={result}
                          setEditingResult={setEditingResult}
                          setUpdateDialogOpen={setUpdateDialogOpen}
                          isDictionaryNote={isDictionaryNote}
                        />
                      )}
                    {result.category === "粤语曲库" && (
                      <YueSongCardDetail result={result} />
                    )}
                  </motion.div>
                ))}

                {totalPages > 1 && (
                  <motion.div
                    className="flex justify-center gap-2 mt-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {/* Previous button */}
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-10 h-10"
                    >
                      &lt;
                    </Button>

                    {/* Page numbers */}
                    {getPageNumbers().map((page, idx) =>
                      page === '...' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="w-10 h-10 flex items-center justify-center text-gray-500"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          onClick={() => setCurrentPage(page as number)}
                          className="w-10 h-10"
                        >
                          {page}
                        </Button>
                      )
                    )}

                    {/* Next button */}
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10"
                    >
                      &gt;
                    </Button>
                  </motion.div>
                )}

                {/* 示例卡片 */}
                {results && results.length > 0 && (
                  <motion.div
                    className="mt-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-500">
                        Try other searches
                      </h3>
                      <Button
                        variant="outline"
                        onClick={handleBackToHome}
                        className="text-sm"
                      >
                        Back to Home
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {[
                        { title: "Cantonese Lyrics", prompt: "落花流水" },
                        { title: "Chinese Words", prompt: "姐姐" },
                        { title: "Single Character", prompt: "行" },
                        { title: "Video Example", prompt: "歡聚一堂" },
                      ].map(
                        (example) =>
                          example.prompt !== searchPrompt && (
                            <Card
                              key={example.prompt}
                              className="p-3 sm:p-4 hover:shadow-lg cursor-pointer hover:bg-primary/5 dark:hover:bg-gray-800 transition-colors duration-200 h-24 sm:h-28 flex items-center justify-center"
                              onClick={() => {
                                if (isPending) return;
                                setResults(null);
                                handleExampleSearch(example.prompt);
                              }}
                            >
                              <div className="text-center space-y-1 sm:space-y-2">
                                <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {example.title}
                                </h3>
                                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                                  {example.prompt}
                                </p>
                              </div>
                            </Card>
                          )
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              results &&
              results.length === 0 && (
                <motion.div
                  className="w-full max-w-4xl text-center py-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
                      <SearchX className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        No results found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                        We couldn&apos;t find any matches for &quot;
                        {searchPrompt}&quot;. Try searching with different
                        keywords or check out our example searches below.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleBackToHome}
                        className="mt-4"
                      >
                        返回首页
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
                      <Card
                        className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                        onClick={() => handleExampleSearch("淡淡交會過")}
                      >
                        <div className="text-center space-y-1 sm:space-y-2">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                            Cantonese Lyrics
                          </h3>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            淡淡交會過
                          </p>
                        </div>
                      </Card>
                      <Card
                        className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                        onClick={() => handleExampleSearch("姐姐")}
                      >
                        <div className="text-center space-y-1 sm:space-y-2">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                            Chinese Words
                          </h3>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            姐姐
                          </p>
                        </div>
                      </Card>
                      <Card
                        className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                        onClick={() => handleExampleSearch("行")}
                      >
                        <div className="text-center space-y-1 sm:space-y-2">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                            Single Character
                          </h3>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">行</p>
                        </div>
                      </Card>
                      <Card
                        className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24 sm:h-28 flex items-center justify-center"
                        onClick={() => handleExampleSearch("歡聚一堂")}
                      >
                        <div className="text-center space-y-1 sm:space-y-2">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                            Video Example
                          </h3>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            歡聚一堂
                          </p>
                        </div>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
      {/* Update Dialog */}
      <EditCorpusDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        editingResult={editingResult}
      />
    </>
  );
}
