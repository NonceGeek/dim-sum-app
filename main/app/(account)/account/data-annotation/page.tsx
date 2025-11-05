"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { dataAnnotationApi, CorpusItem } from "@/lib/api/data-annotation";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, X, Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { CreateDialog } from "@/components/data-annotation/CreateDialog";
import { BatchUploadDialog } from "@/components/data-annotation/BatchUploadDialog";

const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150 mr-2";

export default function DataAnnotationPage() {
  const [corpusData, setCorpusData] = useState<CorpusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const router = useRouter();

  const itemsPerPage = 10;

  const fetchCorpusData = async (page: number, query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dataAnnotationApi.getCorpusItems(page, itemsPerPage, query || searchQuery);
      setCorpusData(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalCount(response.pagination.totalCount);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch corpus data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch corpus data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorpusData(1);
  }, []);

  const handleSearch = () => {
    if (searchInput) {
      setSearchQuery(searchInput);
      setCurrentPage(1);
      fetchCorpusData(1, searchInput);
    } else {
      handleClearSearch();
    }
  };

  const handleClearSearch = async () => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
    
    // 立即清空搜索结果，重新获取所有数据
    setIsLoading(true);
    setError(null);
    try {
      const response = await dataAnnotationApi.getCorpusItems(1, itemsPerPage, "");
      setCorpusData(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalCount(response.pagination.totalCount);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to fetch corpus data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch corpus data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/data_annotation_template.xlsx";
    link.download = "data_annotation_template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (uuid: string) => {
    // 跳转到详情页，查看模式
    router.push(`/account/data-annotation/${uuid}?mode=view`);
  };

  const handleEdit = (uuid: string, editableLevel: number) => {
    // 检查是否可编辑
    if (editableLevel === 0) {
      toast.error("此条目不可编辑");
      return;
    }
    // 跳转到详情页，编辑模式
    router.push(`/account/data-annotation/${uuid}?mode=edit`);
  };

  // 暂时注释删除和审核功能
  // const handleDelete = (uuid: string) => {
  //   console.log("删除", uuid);
  //   router.push(`/account/data-annotation/${uuid}`);
  // };
  // const handleReview = (uuid: string) => {
  //   console.log("审核", uuid);
  //   router.push(`/account/data-annotation/${uuid}`);
  // };

  // 根据条目的可编辑状态显示不同操作
  const getAvailableActions = (item: CorpusItem) => {
    const actions = [
      {
        name: "查看",
        handler: () => handleView(item.unique_id),
        className: "text-gray-300 hover:text-blue-400"
      }
    ];

    // 只有可编辑的条目才显示编辑按钮
    if (item.editable_level > 0) {
      actions.push({
        name: "编辑",
        handler: () => handleEdit(item.unique_id, item.editable_level),
        className: "text-gray-300 hover:text-green-400"
      });
    }

    // 暂时注释删除和审核操作
    // actions.push({
    //   name: "删除",
    //   handler: () => handleDelete(item.unique_id),
    //   className: "text-gray-300 hover:text-red-400"
    // });
    // actions.push({
    //   name: "审核",
    //   handler: () => handleReview(item.unique_id),
    //   className: "text-gray-300 hover:text-purple-400"
    // });

    return actions;
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchCorpusData(currentPage + 1, searchQuery);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchCorpusData(currentPage - 1, searchQuery);
    }
  };

  const handleFirstPage = () => {
    if (currentPage !== 1) {
      fetchCorpusData(1, searchQuery);
    }
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-2 bg-card border border-gray-600 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search data..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 bg-transparent text-white placeholder-gray-400 focus:ring-0 focus:border-0 w-64"
            />
            {searchInput && (
              <Button
                onClick={handleClearSearch}
                variant="ghost"
                size="sm"
                className="p-1 h-auto text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={handleSearch}
              variant="ghost"
              size="sm"
              className="p-2 h-auto text-gray-400 hover:text-white hover:bg-gray-700"
            >
              Search
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Data Annotation</h1>
            {totalCount > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                Total: {totalCount} items | Page {currentPage} of {totalPages}
                {searchQuery && (
                  <span className="ml-2">
                    (searching for: "{searchQuery}")
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateDialog(true)}
              className={buttonClass}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
            <Button
              onClick={() => setShowBatchUploadDialog(true)}
              className={buttonClass}
            >
              <Upload className="w-4 h-4 mr-2" />
              Batch Upload
            </Button>
            <Button
              onClick={downloadTemplate}
              className={buttonClass}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">Error: {error}</p>
            <Button 
              onClick={() => fetchCorpusData(currentPage)} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-8">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-6 bg-card">
                <Skeleton className="h-8 w-1/4 mb-4" />
                <Skeleton className="h-24 w-full" />
              </Card>
            ))
          ) : corpusData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                {searchQuery 
                  ? `No results found for "${searchQuery}"` 
                  : "No data available"
                }
              </p>
              {searchQuery && (
                <Button 
                  onClick={handleClearSearch}
                  variant="outline" 
                  className="mt-4"
                >
                  Clear search and show all data
                </Button>
              )}
            </div>
          ) : (
            corpusData.map((item) => (
              <Card
                key={item.unique_id}
                className="p-6 bg-card transition-all duration-200 hover:shadow-lg"
              >
                <Table className="w-full border-collapse overflow-hidden bg-transparent text-white text-base border border-white/20">
                  <TableHeader>
                    <TableRow className="bg-[#23242a]">
                      <TableHead className="w-24 text-center border-r border-gray-600 text-white text-base">字</TableHead>
                      <TableHead className="w-48 text-center border-r border-gray-600 text-white text-base">粤音</TableHead>
                      <TableHead className="w-1/2 text-center border-r border-gray-600 text-white text-base">详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.note?.context?.pinyin && Array.isArray(item.note.context.pinyin) && item.note.context.pinyin.length > 0 ? (
                      item.note.context.pinyin.map((pinyin: any, pinyinIndex: number) => (
                        <TableRow key={`${item.unique_id}-${pinyinIndex}`} className="text-white text-base">
                          {pinyinIndex === 0 ? (
                            <TableCell rowSpan={item.note.context.pinyin.length} className="text-center border-r border-gray-600 align-middle text-2xl">
                              {item.data}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-center border border-gray-600 px-4 py-3">
                            {pinyin}
                          </TableCell>
                          <TableCell className="border border-gray-600 px-4 py-3 text-center">
                            {getAvailableActions(item).map((action, actionIndex) => (
                              <React.Fragment key={action.name}>
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    action.handler();
                                  }}
                                  className={`mx-1 transition-colors duration-150 cursor-pointer ${action.className}`}
                                >
                                  {action.name}
                                </a>
                                {actionIndex < getAvailableActions(item).length - 1 && (
                                  <span className="text-gray-500">|</span>
                                )}
                              </React.Fragment>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      // 如果没有拼音数据，显示一个默认行
                      <TableRow className="text-white text-base">
                        <TableCell className="border border-gray-600 px-4 py-3 text-center text-lg">{item.data}</TableCell>
                        <TableCell className="border border-gray-600 px-4 py-3 italic text-gray-500">No pinyin data</TableCell>
                        <TableCell className="border border-gray-600 px-4 py-3 text-center">
                          {getAvailableActions(item).map((action, actionIndex) => (
                            <React.Fragment key={action.name}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  action.handler();
                                }}
                                className={`mx-1 transition-colors duration-150 cursor-pointer ${action.className}`}
                              >
                                {action.name}
                              </a>
                              {actionIndex < getAvailableActions(item).length - 1 && (
                                <span className="text-gray-500">|</span>
                              )}
                            </React.Fragment>
                          ))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {!isLoading && corpusData.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <Button
              onClick={handleFirstPage}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              1
            </Button>
            
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>

            <Input placeholder="Go to Page" type="number" min={1} max={totalPages} className="w-28 text-center bg-card border border-gray-600 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const page = Number((e.target as HTMLInputElement).value);
                  if (page >= 1 && page <= totalPages) {
                    fetchCorpusData(page, searchQuery);
                  } else {
                    toast.error(`Please enter a valid page number between 1 and ${totalPages}`);
                  }
                }
              }}
            />
            
            <Button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* 弹窗组件 */}
      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => fetchCorpusData(currentPage)}
      />

      <BatchUploadDialog
        open={showBatchUploadDialog}
        onOpenChange={setShowBatchUploadDialog}
        onSuccess={() => fetchCorpusData(currentPage)}
      />
    </>
  );
}
