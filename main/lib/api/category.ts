import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface CategoryInfo {
  id: number;
  name: string;
  nickname?: string;
  description?: string;
  likes?: number;
  created_at: string;
  updated_at?: string;
  cover?: string;
  status: string;
  link?: string;
  tags?: any;
  pinned: boolean;
  editable_level: number;
  linked_apps?: any;
  if_in_all_data?: boolean;
  is_public?: boolean;
  sorting?: number;
}

export function useCategoryEditableLevel(categoryName: string | null) {
  return useQuery<number | null>({
    queryKey: ["categoryEditableLevel", categoryName],
    queryFn: async () => {
      if (!categoryName) return null;
      const response = await fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/v2/corpus_category?name=${categoryName}`
      );
      const data = await response.json();
      return data?.editable_level || null;
    },
    enabled: !!categoryName,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

/** 根据 corpus name 获取中文 nickname，找不到则返回原始 name */
export function getCategoryNickname(categories: CategoryInfo[], name: string): string {
  const cat = categories.find((c) => c.name === name);
  return cat?.nickname || name;
}

// 获取全量分类信息
export async function fetchAllCategories(): Promise<CategoryInfo[]> {
  const response = await fetch(
    process.env.NEXT_PUBLIC_BACKEND_URL + "/corpus_categories"
  );
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  return response.json();
}

export function useAllCategories() {
  return useQuery<CategoryInfo[]>({
    queryKey: ['allCategories'],
    queryFn: fetchAllCategories,
    staleTime: Infinity, // 会话内永不重新请求（分类数据基本不变）
    gcTime: Infinity,    // tab 关闭前始终保留在内存，不主动 GC
  });
}
