import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssistantUIMessage } from "@/lib/assistant/conversation";
import { api } from "./client";

export type AssistantConversationSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantQuota = { limit: number; used: number; remaining: number };

export const assistantKeys = {
  conversations: ["assistant", "conversations"] as const,
  conversation: (id: string) => ["assistant", "conversation", id] as const,
  quota: ["assistant", "quota"] as const,
};

export function useAssistantConversations() {
  return useQuery({
    queryKey: assistantKeys.conversations,
    queryFn: () =>
      api
        .get<{ conversations: AssistantConversationSummary[] }>("/api/assistant/conversations")
        .then((r) => r.conversations),
  });
}

export function useAssistantConversation(id: string | null) {
  return useQuery({
    queryKey: assistantKeys.conversation(id ?? ""),
    enabled: Boolean(id),
    retry: false,
    // 对话组件只在挂载时读取历史，不缓存，保证切回会话时拿到最新消息
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api.get<{ messages: AssistantUIMessage[] }>(`/api/assistant/conversations/${id}`),
  });
}

export function useAssistantQuota() {
  return useQuery({
    queryKey: assistantKeys.quota,
    queryFn: () => api.get<AssistantQuota>("/api/assistant/quota"),
  });
}

export function useDeleteAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/assistant/conversations/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: assistantKeys.conversations }),
  });
}
