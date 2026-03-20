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
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, X, Plus, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CreateDialog } from "@/components/data-annotation/CreateDialog";
import { BatchUploadDialog } from "@/components/data-annotation/BatchUploadDialog";
import { useTranslations } from "next-intl";

const buttonClass =
  "rounded-full border border-border px-6 py-2 text-foreground bg-transparent hover:bg-accent transition-colors duration-150 mr-2";

export default function DataAnnotationPage() {
  const t = useTranslations("DataAnnotation");
  const tc = useTranslations("Common");
  const tv = useTranslations("Validation");
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
      toast.error(t("notEditable"));
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
        name: t("view"),
        handler: () => handleView(item.unique_id),
        className: "text-muted-foreground hover:text-info"
      }
    ];

    // 只有可编辑的条目才显示编辑按钮
    if (item.editable_level > 0) {
      actions.push({
        name: tc("edit"),
        handler: () => handleEdit(item.unique_id, item.editable_level),
        className: "text-muted-foreground hover:text-success"
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
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 bg-transparent text-foreground placeholder-muted-foreground focus:ring-0 focus:border-0 w-64"
            />
            {searchInput && (
              <Button
                onClick={handleClearSearch}
                disabled={isLoading}
                variant="ghost"
                size="sm"
                className="p-1 h-auto text-muted-foreground hover:text-foreground"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            )}
            <Button
              onClick={handleSearch}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="p-2 h-auto text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("searchButton")
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            {totalCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {t("total", { count: totalCount })} | {t("pageOf", { current: currentPage, total: totalPages })}
                {searchQuery && (
                  <span className="ml-2">
                    {t("searchingFor", { query: searchQuery })}
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
              {tc("create")}
            </Button>
            <Button
              onClick={() => setShowBatchUploadDialog(true)}
              className={buttonClass}
            >
              <Upload className="w-4 h-4 mr-2" />
              {t("batchUpload")}
            </Button>
            <Button
              onClick={downloadTemplate}
              className={buttonClass}
            >
              <Download className="w-4 h-4 mr-2" />
              {t("downloadTemplate")}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{t("error")}: {error}</p>
            <Button
              onClick={() => fetchCorpusData(currentPage)}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("retrying")}
                </>
              ) : (
                t("retry")
              )}
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
              <p className="text-muted-foreground text-lg">
                {searchQuery
                  ? t("noResults", { query: searchQuery })
                  : tc("noData")
                }
              </p>
              {searchQuery && (
                <Button
                  onClick={handleClearSearch}
                  disabled={isLoading}
                  variant="outline"
                  className="mt-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {tc("loading")}
                    </>
                  ) : (
                    t("clearSearch")
                  )}
                </Button>
              )}
            </div>
          ) : (
            corpusData.map((item) => (
              <Card
                key={item.unique_id}
                className="p-6 bg-card transition-all duration-200 hover:shadow-lg"
              >
                <Table className="w-full border-collapse overflow-hidden bg-transparent text-foreground text-base border border-border">
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="w-24 text-center border-r border-border text-foreground text-base">{t("character")}</TableHead>
                      <TableHead className="w-48 text-center border-r border-border text-foreground text-base">{t("pronunciation")}</TableHead>
                      <TableHead className="w-1/2 text-center border-r border-border text-foreground text-base">{t("details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.note?.context?.pinyin && Array.isArray(item.note.context.pinyin) && item.note.context.pinyin.length > 0 ? (
                      item.note.context.pinyin.map((pinyin: any, pinyinIndex: number) => (
                        <TableRow key={`${item.unique_id}-${pinyinIndex}`} className="text-foreground text-base">
                          {pinyinIndex === 0 ? (
                            <TableCell rowSpan={item.note.context.pinyin.length} className="text-center border-r border-border align-middle text-2xl">
                              {item.data}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-center border border-border px-4 py-3">
                            {pinyin}
                          </TableCell>
                          <TableCell className="border border-border px-4 py-3 text-center">
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
                                  <span className="text-muted-foreground">|</span>
                                )}
                              </React.Fragment>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      // 如果没有拼音数据，显示一个默认行
                      <TableRow className="text-foreground text-base">
                        <TableCell className="border border-border px-4 py-3 text-center text-lg">{item.data}</TableCell>
                        <TableCell className="border border-border px-4 py-3 italic text-muted-foreground">{t("noPinyinData")}</TableCell>
                        <TableCell className="border border-border px-4 py-3 text-center">
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
                                <span className="text-muted-foreground">|</span>
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
              disabled={currentPage === 1 || isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <ChevronLeft className="w-4 h-4 mr-1" />
              )}
              {t("previous")}
            </Button>

            <Button
              onClick={handleFirstPage}
              disabled={currentPage === 1 || isLoading}
              variant="outline"
              size="sm"
            >
              1
            </Button>

            <span className="text-sm text-muted-foreground">
              {t("pageOf", { current: currentPage, total: totalPages })}
            </span>

            <Input placeholder={t("goToPage")} type="number" min={1} max={totalPages} className="w-28 text-center bg-card border border-border text-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const page = Number((e.target as HTMLInputElement).value);
                  if (page >= 1 && page <= totalPages) {
                    fetchCorpusData(page, searchQuery);
                  } else {
                    toast.error(t("invalidPage", { max: totalPages }));
                  }
                }
              }}
            />
            
            <Button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || isLoading}
              variant="outline"
              size="sm"
            >
              {t("next")}
              {isLoading ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4 ml-1" />
              )}
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
