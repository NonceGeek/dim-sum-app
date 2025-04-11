"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { useSearch, type SearchResult } from "@/hooks/useSearch";
import { toast } from "sonner";
import { Search, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from '@/components/layout/header';

export default function HomePage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const { mutate: search, isPending } = useSearch();

  const handleSearch = () => {
    if (!searchPrompt.trim()) return;
    setCurrentPage(1);
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

  const totalPages = Math.ceil((results?.length || 0) / itemsPerPage);
  const currentResults = results?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || [];

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-50">
        <Header showLogo />
      </div>
      <motion.div 
        className="container mx-auto p-6 space-y-8 min-h-screen flex flex-col md:pt-6 pt-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div 
          className="flex flex-col items-center space-y-6 flex-grow"
          initial={{ justifyContent: "center", opacity: 0, y: 20 }}
          animate={{ 
            justifyContent: results && results.length > 0 ? "flex-start" : "center",
            paddingTop: results && results.length > 0 ? "2rem" : "0",
            opacity: 1,
            y: 0
          }}
          transition={{ 
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1]
          }}
        >
          <motion.h1 
            className="text-4xl font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent"
            initial={{ scale: 1, y: 0, opacity: 0 }}
            animate={{ 
              scale: results && results.length > 0 ? 0.8 : 1,
              y: results && results.length > 0 ? -20 : 0,
              opacity: 1
            }}
            transition={{ 
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1]
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
              opacity: 1
            }}
            transition={{ 
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            <motion.div 
              className="flex gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1]
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
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={isPending}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6"
              >
                {isPending ? "Searching..." : "Search"}
              </Button>
            </motion.div>
            
            {results === null && (
              <motion.div 
                className="w-full max-w-2xl space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 0.5,
                  delay: 0.3,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card 
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      const prompt = "淡淡交會過";
                      setSearchPrompt(prompt);
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
                    }}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cantonese Lyrics</h3>
                      <p className="text-gray-600 dark:text-gray-400">淡淡交會過</p>
                    </div>
                  </Card>
                  <Card 
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      const prompt = "故乡";
                      setSearchPrompt(prompt);
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
                    }}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Chinese Words</h3>
                      <p className="text-gray-600 dark:text-gray-400">故乡</p>
                    </div>
                  </Card>
                  <Card 
                    className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      const prompt = "好";
                      setSearchPrompt(prompt);
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
                    }}
                  >
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Single Character</h3>
                      <p className="text-gray-600 dark:text-gray-400">好</p>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {results && results.length > 0 ? (
              <motion.div 
                className="w-full max-w-4xl space-y-4"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ 
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                {currentResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.5,
                      delay: index * 0.1,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    <Card className="p-6">
                      <div className="space-y-4">
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{result.data}</ReactMarkdown>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {result.note.map((note, idx) => (
                            <div key={idx}>
                              <p><b>Pronunciation:</b> {note.context.pron}</p>
                              <p><b>Author:</b> {note.context.author}</p>
                            </div>
                          ))}
                          <p><b>Category:</b> {result.category}</p>
                          <p><b>Tags:</b> {result.tags.join(", ")}</p>
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
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => setCurrentPage(page)}
                        className="w-10 h-10"
                      >
                        {page}
                      </Button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ) : results && results.length === 0  && (
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
                      We couldn&apos;t find any matches for &quot;{searchPrompt}&quot;. Try searching with different keywords or check out our example searches below.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <Card 
                      className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => {
                        const prompt = "淡淡交會過";
                        setSearchPrompt(prompt);
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
                      }}
                    >
                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cantonese Lyrics</h3>
                        <p className="text-gray-600 dark:text-gray-400">淡淡交會過</p>
                      </div>
                    </Card>
                    <Card 
                      className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => {
                        const prompt = "故乡";
                        setSearchPrompt(prompt);
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
                      }}
                    >
                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Chinese Words</h3>
                        <p className="text-gray-600 dark:text-gray-400">故乡</p>
                      </div>
                    </Card>
                    <Card 
                      className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => {
                        const prompt = "好";
                        setSearchPrompt(prompt);
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
                      }}
                    >
                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Single Character</h3>
                        <p className="text-gray-600 dark:text-gray-400">好</p>
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
} 