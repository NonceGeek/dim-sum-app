"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dataAnnotationApi, CreateCorpusItemRequest, BatchCreateRequest } from "@/lib/api/data-annotation";
import { toast } from "sonner";

export function useCreateCorpusItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCorpusItemRequest) => dataAnnotationApi.createCorpusItem(data),
    onSuccess: (data) => {
      toast.success(`数据创建成功！历史ID: ${data.history_id}`);
      // 刷新列表数据
      queryClient.invalidateQueries({ queryKey: ["corpusItems"] });
    },
    onError: (error: Error) => {
      console.error("创建失败:", error);
      toast.error(error.message || "创建失败，请重试");
    },
  });
}

export function useBatchCreateCorpusItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchCreateRequest) => dataAnnotationApi.batchCreateCorpusItems(data),
    onSuccess: (data) => {
      toast.success(`批量上传成功！共创建 ${data.count} 条数据`);
      // 刷新列表数据
      queryClient.invalidateQueries({ queryKey: ["corpusItems"] });
    },
    onError: (error: Error) => {
      console.error("批量上传失败:", error);
      toast.error(error.message || "批量上传失败，请重试");
    },
  });
}