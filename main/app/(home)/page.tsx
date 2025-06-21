/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { toast } from "sonner";
import { Search, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "@/components/layout/header";
import ReactPlayer from "react-player";
import { stringify } from "querystring";
import { useRouter, useSearchParams } from "next/navigation";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";

// Type guard for dictionary note
function isDictionaryNote(note: SearchResult["note"]): note is {
  context: {
    page?: number;
    number?: string;
    others?: {
      異體?: any[];
      校訂註?: string | null;
    };
    pinyin?: string[];
    meaning?: string[];
  };
  contributor?: string;
} {
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 从URL参数读取搜索关键词
  useEffect(() => {
    const keyword = searchParams.get("q");

    // 当URL变为根路径时，重置页面状态
    if (!keyword) {
      if (searchPrompt || results) {
        setSearchPrompt("");
        setResults(null);
        setCurrentPage(1);
      }
      setIsInitialLoad(false);
      return;
    }

    // 只有在初始加载或有新的搜索关键词时才执行搜索
    if (isInitialLoad || keyword !== searchPrompt) {
      setSearchPrompt(keyword);
      setIsInitialLoad(false);
      // 自动执行搜索
      search(
        { keyword },
        {
          onSuccess: (data: SearchResult[]) => {
            setResults(data);
          },
          onError: (error: Error) => {
            console.error("Search failed:", error);
            toast.error("Search failed", {
              description: error.message,
            });
          },
        }
      );
    }
  }, [searchParams, search, isInitialLoad]);

  const handleSearch = () => {
    if (!searchPrompt.trim()) return;
    setCurrentPage(1);

    // 更新URL参数
    const params = new URLSearchParams();
    params.set("q", searchPrompt.trim());
    router.push(`/?${params.toString()}`, { scroll: false });

    // 直接执行搜索，不依赖useEffect
    search(
      { keyword: searchPrompt },
      {
        onSuccess: (data: SearchResult[]) => {
          setResults(data);
        },
        onError: (error: Error) => {
          console.error("Search failed:", error);
          toast.error("Search failed", {
            description: error.message,
          });
        },
      }
    );
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

    // 更新URL参数
    const params = new URLSearchParams();
    params.set("q", prompt);
    router.push(`/?${params.toString()}`, { scroll: false });

    // 直接执行搜索，不依赖useEffect
    search(
      { keyword: prompt },
      {
        onSuccess: (data: SearchResult[]) => {
          setResults(data);
        },
        onError: (error: Error) => {
          console.error("Search failed:", error);
          toast.error("Search failed", {
            description: error.message,
          });
        },
      }
    );
  };

  // 返回首页函数
  const handleBackToHome = () => {
    router.push("/", { scroll: false });
    setSearchPrompt("");
    setResults(null);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil((results?.length || 0) / itemsPerPage);
  const currentResults =
    results?.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    ) || [];

  return (
    <>
      {/* <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <Header showLogo />
      </div> */}
      <motion.div
        className="container mx-auto p-6 space-y-8 flex flex-col md:pt-6 pt-20 overflow-y-scroll"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="flex flex-col items-center space-y-6 flex-grow pt-14 md:pt-0"
          initial={{ justifyContent: "center", opacity: 0, y: 20 }}
          animate={{
            justifyContent:
              results && results.length > 0 ? "flex-start" : "center",
            paddingTop: results && results.length > 0 ? "2rem" : "0",
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
                <div className="flex flex-wrap justify-center gap-4">
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("淡淡交會過")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Cantonese Lyrics
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        淡淡交會過
                      </p>
                    </div>
                  </Card>
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("唔")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        News
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">唔</p>
                    </div>
                  </Card>
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("行")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Single Character
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">行</p>
                    </div>
                  </Card>
                  <div className="w-full"></div>
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("故乡")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Chinese Words
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">故乡</p>
                    </div>
                  </Card>
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("歡聚一堂")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        Video Example
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        歡聚一堂
                      </p>
                    </div>
                  </Card>
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExampleSearch("帆船")}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        3D Model
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">帆船</p>
                    </div>
                  </Card>
                </div>
                <hr></hr>
                <h2 className="text-2xl font-semibold text-center text-gray-900 dark:text-black-100">
                  数据情况
                </h2>
                <div className="w-[150%] -ml-[25%]">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-6 mb-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        文本资料
                      </h3>
                      <p className="text-2xl font-bold text-fuchsia-300">20,000+</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        条记录
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        音视频资料
                      </h3>
                      <p className="text-3xl font-bold text-fuchsia-300">100+</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        GB
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        图片资料
                      </h3>
                      <p className="text-3xl font-bold text-fuchsia-300">100 +</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        张
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        语料集数量
                      </h3>
                      <p className="text-3xl font-bold text-fuchsia-300">20 +</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        个
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        应用数量
                      </h3>
                      <p className="text-3xl font-bold text-fuchsia-300">10 +</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        个
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        总数据规模
                      </h3>
                      <p className="text-3xl font-bold text-fuchsia-300">100+</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        GB
                      </p>
                    </div>
                  </div>
                </div>
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
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
                    <Card className="p-6 shadow-md hover:bg-primary/5 dark:hover:bg-gray-800 transition-colors duration-200">
                      <div className="space-y-6">
                        <div className="prose dark:prose-invert max-w-none relative">
                          <div className="flex justify-between items-start">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                              {result.data}
                            </h3>
                            <Button
                              onClick={() => {
                                setEditingResult(result);
                                setUpdateDialogOpen(true);
                              }}
                              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6"
                            >
                              Update
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-4">
                          {/* Display note content */}
                          {result.note && (
                            <div className="space-y-2">
                              {result.category === "广州话正音字典" ? (
                                // Detailed display for zyzd category
                                <>
                                  {/* <p>isDictionaryNote check result: {String(isDictionaryNote(result.note))}</p>
                                  <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                    {JSON.stringify(result.note, null, 2)}
                                  </pre> */}
                                  {isDictionaryNote(result.note) && (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
                                      {result.note.context.meaning && (
                                          <p className="leading-relaxed">
                                           <b className="text-fuchsia-300">釋義：</b>{" "}
                                          {Array.isArray(
                                            result.note.context.meaning
                                          )
                                            ? result.note.context.meaning.join(
                                                "、 "
                                              )
                                            : result.note.context.meaning}
                                        </p>
                                      )}
                                      {result.note.context.pinyin && (
                                        <p className="leading-relaxed">
                                          <b className="text-fuchsia-300">粵拼：</b>{" "}
                                          {Array.isArray(
                                            result.note.context.pinyin
                                          )
                                            ? result.note.context.pinyin.join(
                                                "、 "
                                              )
                                            : result.note.context.pinyin}
                                        </p>
                                      )}
                                      {result.note.contributor && (
                                        <p className="leading-relaxed">
                                          <b className="text-fuchsia-300">
                                            貢獻者：
                                          </b>{" "}
                                          {result.note.contributor}
                                        </p>
                                      )}
                                      {result.note.context.page && (
                                        <p className="leading-relaxed">
                                          <b className="text-fuchsia-300">頁碼：</b>{" "}
                                          {result.note.context.page}
                                        </p>
                                      )}
                                      {result.note.context.number && (
                                        <p className="leading-relaxed">
                                          <b className="text-fuchsia-300">編號：</b>{" "}
                                          {result.note.context.number}
                                        </p>
                                      )}
                                      {result.note.context.others && (
                                        <p className="leading-relaxed">
                                          <b className="text-fuchsia-300">其他：</b>{" "}
                                          {JSON.stringify(
                                            result.note.context.others
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Simple display for other categories
                                <div>
                                  {typeof result.note === "object" &&
                                    !Array.isArray(result.note) &&
                                    !("meaning" in result.note) &&
                                    "context" in result.note && (
                                      <div className="space-y-4">
                                        {(
                                          result.note as {
                                            context: {
                                              video?: string;
                                              subtitle?: string;
                                            };
                                          }
                                        ).context.video ? (
                                          <div className="space-y-4">
                                            <div className="relative pt-[56.25%] rounded-lg overflow-hidden shadow-md">
                                              <ReactPlayer
                                                url={
                                                  (
                                                    result.note as {
                                                      context: {
                                                        video: string;
                                                      };
                                                    }
                                                  ).context.video
                                                }
                                                controls
                                                width="100%"
                                                height="100%"
                                                className="absolute top-0 left-0"
                                                config={{
                                                  file: {
                                                    attributes: {
                                                      controlsList:
                                                        "nodownload",
                                                      disablePictureInPicture:
                                                        true,
                                                    },
                                                  },
                                                }}
                                              />
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                              <p className="whitespace-pre-line leading-relaxed">
                                                                                          <b className="text-fuchsia-300">
                                            Subtitles:
                                                </b>{" "}
                                                {
                                                  (
                                                    result.note as {
                                                      context: {
                                                        subtitle: string;
                                                      };
                                                    }
                                                  ).context.subtitle
                                                }
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
                                            {Object.entries(
                                              (
                                                result.note as {
                                                  context: Record<
                                                    string,
                                                    unknown
                                                  >;
                                                }
                                              ).context
                                            )
                                              .filter(
                                                ([key]) =>
                                                  key !== "video" &&
                                                  key !== "subtitle"
                                              )
                                              .map(
                                                ([key, value]) =>
                                                  value && (
                                                    <p
                                                      className="leading-relaxed"
                                                      key={key}
                                                    >
                                                      <b className="text-fuchsia-300">
                                                        {key
                                                          .charAt(0)
                                                          .toUpperCase() +
                                                          key.slice(1)}
                                                        :
                                                      </b>{" "}
                                                      {Array.isArray(value) ? (
                                                        value.join(", ")
                                                      ) : typeof value ===
                                                          "string" &&
                                                        value.startsWith(
                                                          "http"
                                                        ) ? (
                                                        <iframe
                                                          src={value}
                                                          title={key}
                                                          className="w-full h-64 rounded border mt-2"
                                                          allowFullScreen
                                                        />
                                                      ) : (
                                                        String(value)
                                                      )}
                                                    </p>
                                                  )
                                              )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <span className="px-3 py-1 bg-primary/10 text-fuchsia-300 rounded-full text-xs font-medium border border-primary/20">
                              {result.category}
                            </span>
                            {result.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs border border-gray-200 dark:border-gray-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <br></br>
                          {(result.category === "广州话正音字典" ||
                            result.category === "广州话正音字典（例）") && (
                            <div>
                              <p>
                                关联应用:&nbsp;&nbsp;&nbsp;
                                <a
                                  href={`https://card.app.aidimsum.com/?uuid=${result.unique_id}`}
                                  target="_blank"
                                  className="px-3 py-1 bg-primary/10 bg-fuchsia-300 rounded-full text-xs font-medium border border-primary/20"
                                >
                                  🎴 卡片生成
                                </a>
                                <br></br>
                                <br></br>
                                推荐应用:&nbsp;&nbsp;&nbsp;
                                <a
                                  href={`https://baidu.com?uuid=${result.unique_id}`}
                                  target="_blank"
                                  className="px-3 py-1 bg-primary/10 bg-fuchsia-300 rounded-full text-xs font-medium border border-primary/20"
                                >
                                  🤖 语言学 Agent
                                </a>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          onClick={() => setCurrentPage(page)}
                          className="w-10 h-10"
                        >
                          {page}
                        </Button>
                      )
                    )}
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
                    <div className="flex flex-wrap justify-center gap-4">
                      {[
                        { title: "Cantonese Lyrics", prompt: "淡淡交會過" },
                        { title: "Chinese Words", prompt: "故乡" },
                        { title: "Single Character", prompt: "行" },
                        { title: "Video Example", prompt: "歡聚一堂" },
                      ].map(
                        (example) =>
                          example.prompt !== searchPrompt && (
                            <Card
                              key={example.prompt}
                              className="p-4 hover:shadow-lg cursor-pointer hover:bg-primary/5 dark:hover:bg-gray-800 transition-colors duration-200"
                              onClick={() => {
                                if (isPending) return;
                                setResults(null);
                                handleExampleSearch(example.prompt);
                              }}
                            >
                              <div className="space-y-2">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                  {example.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                      <Card
                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleExampleSearch("淡淡交會過")}
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Cantonese Lyrics
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            淡淡交會過
                          </p>
                        </div>
                      </Card>
                      <Card
                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleExampleSearch("故乡")}
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Chinese Words
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            故乡
                          </p>
                        </div>
                      </Card>
                      <Card
                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleExampleSearch("行")}
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Single Character
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">行</p>
                        </div>
                      </Card>
                      <Card
                        className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleExampleSearch("歡聚一堂")}
                      >
                        <div className="space-y-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Video Example
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
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
