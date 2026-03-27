"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taskReviewApi } from "@/lib/api/task-review";
import type { TaskListParams, TaskStatsParams } from "@/lib/types/task-review";
import { toast } from "sonner";

export function useTasks(params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => taskReviewApi.getTasks(params),
    enabled,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => taskReviewApi.getTask(id!),
    enabled: !!id,
  });
}

export function useTaskStats(params: TaskStatsParams | null) {
  return useQuery({
    queryKey: ["taskStats", params],
    queryFn: () => taskReviewApi.getStats(params!),
    enabled: !!params?.corpusName,
  });
}

export function usePublicUsers(userIds: string[]) {
  return useQuery({
    queryKey: ["publicUsers", userIds],
    queryFn: () => taskReviewApi.getUsers(userIds),
    enabled: userIds.length > 0,
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, selected }: { id: string; selected: unknown[] }) =>
      taskReviewApi.completeTask(id, { selected }),
    onSuccess: () => {
      toast.success("任务提交成功");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "提交失败，请重试");
    },
  });
}

export function useSkipTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskReviewApi.skipTask(id),
    onSuccess: () => {
      toast.success("任务已跳过");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "操作失败，请重试");
    },
  });
}

export function useViewTask() {
  return useMutation({
    mutationFn: (id: string) => taskReviewApi.viewTask(id),
  });
}

export function useUploadAudio() {
  return useMutation({
    mutationFn: (formData: FormData) => taskReviewApi.uploadAudio(formData),
    onError: (error: Error) => {
      toast.error(error.message || "上传失败");
    },
  });
}
