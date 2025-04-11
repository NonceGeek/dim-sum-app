"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { useSearch, type SearchResult } from "@/hooks/useSearch";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function HomePage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
          toast.error("搜索失败", {
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

  const totalPages = Math.ceil(results.length / itemsPerPage);
  const currentResults = results.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <motion.div 
      className="container mx-auto p-6 space-y-8 min-h-screen flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="flex flex-col items-center space-y-6 flex-grow"
        initial={{ justifyContent: "center", opacity: 0, y: 20 }}
        animate={{ 
          justifyContent: results.length > 0 ? "flex-start" : "center",
          paddingTop: results.length > 0 ? "2rem" : "0",
          opacity: 1,
          y: 0
        }}
        transition={{ 
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1]
        }}
      >
        <motion.h1 
          className="text-4xl font-bold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent"
          initial={{ scale: 1, y: 0, opacity: 0 }}
          animate={{ 
            scale: results.length > 0 ? 0.8 : 1,
            y: results.length > 0 ? -20 : 0,
            opacity: 1
          }}
          transition={{ 
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1]
          }}
        >
          DimSum AI Labs
        </motion.h1>
        
        <motion.div 
          className="w-full max-w-2xl space-y-4"
          initial={{ width: "100%", y: 0, opacity: 0 }}
          animate={{ 
            width: results.length > 0 ? "80%" : "100%",
            y: results.length > 0 ? -20 : 0,
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
                placeholder="搜索粤语内容..."
                value={searchPrompt}
                onChange={(e) => setSearchPrompt(e.target.value)}
                onKeyDown={handleKeyPress}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button 
              onClick={handleSearch}
              disabled={isPending}
              className="bg-blue-500 hover:bg-blue-600 text-white h-12 px-6"
            >
              {isPending ? "搜索中..." : "搜索"}
            </Button>
          </motion.div>
          
          {results.length === 0 && (
            <motion.div 
              className="text-sm text-gray-600 dark:text-gray-400 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.5,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1]
              }}
            >
              <p><b>搜索示例：</b></p>
              <p>* 淡淡交會過</p>
              <p>* 故乡</p>
              <p>* 好</p>
            </motion.div>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {results.length > 0 && (
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
                            <p><b>发音：</b> {note.context.pron}</p>
                            <p><b>作者：</b> {note.context.author}</p>
                          </div>
                        ))}
                        <p><b>分类：</b> {result.category}</p>
                        <p><b>标签：</b> {result.tags.join(", ")}</p>
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
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
} 