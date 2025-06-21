"use client";

import { Header } from "@/components/layout/header";
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
import { getCorpusItemByUniqueId, SearchResult } from "@/lib/api/search";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150 mr-2";

export default function DataAnnotationPage() {
  const [corpusData, setCorpusData] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const uuids = [
      "6e29005d-31ed-42d6-be17-baab39b07fa1",
      "90e91e2b-2950-4faa-bb79-ca9261d45da6",
      "ce05f31b-8615-424f-9131-18b813c5fd36",
    ];

    async function fetchAllData() {
      setIsLoading(true);
      try {
        const dataPromises = uuids.map(uuid => getCorpusItemByUniqueId(uuid));
        const results = await Promise.all(dataPromises);
        // 过滤掉未找到的项目 (null)
        setCorpusData(results.filter((item): item is SearchResult => item !== null));
      } catch (error) {
        console.error("Failed to fetch corpus data:", error);
        // 这里可以设置一个错误状态来显示错误信息
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();
  }, []);

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/data_annotation_template.xlsx";
    link.download = "data_annotation_template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (uuid: string) => {
    // 使用动态路由路径
    router.push(`/account/data-annotation/${uuid}`);
  };

  const handleEdit = (uuid: string) => {
    console.log("编辑", uuid);
    router.push(`/account/data-annotation/${uuid}`);
  };
  const handleDelete = (uuid: string) => {
    console.log("删除", uuid);
    router.push(`/account/data-annotation/${uuid}`);
  };
  const handleReview = (uuid: string) => {
    console.log("审核", uuid);
    router.push(`/account/data-annotation/${uuid}`);
  };

  const actionHandlers: Record<string, (uuid: string) => void> = {
    "查看": handleView,
    "编辑": handleEdit,
    "删除": handleDelete,
    "审核": handleReview,
  };

  const actionNames = Object.keys(actionHandlers);

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Data Annotation</h1>
          <div className="flex gap-2">
            <button className={buttonClass}>Create</button>
            <button className={buttonClass}>Save</button>
            <button className={buttonClass}>Delete</button>
            <button className={buttonClass}>Batch Upload</button>
            <button className={buttonClass} onClick={downloadTemplate}>
              Download template
            </button>
          </div>
        </div>
        <div className="grid gap-8">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-6 bg-card">
                <Skeleton className="h-8 w-1/4 mb-4" />
                <Skeleton className="h-24 w-full" />
              </Card>
            ))
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
                    {item.note?.context?.pinyin && item.note.context.pinyin.length > 0 ? (
                      item.note.context.pinyin.map((pinyin, pinyinIndex) => (
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
                            {actionNames.map((actionName, actionIndex) => (
                              <React.Fragment key={actionName}>
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    actionHandlers[actionName](item.unique_id);
                                  }}
                                  className={`mx-1 transition-colors duration-150 cursor-pointer text-gray-300 hover:text-purple-400`}
                                >
                                  {actionName}
                                </a>
                                {actionIndex < actionNames.length - 1 && (
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
                          {/* 同样可以显示操作按钮 */}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
