import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

interface CategoryInfo {
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
}

export function useCategoryEditableLevel(categoryName: string | null) {
  return useQuery<number | null>({
    queryKey: ["categoryEditableLevel", categoryName],
    queryFn: async () => {
      if (!categoryName) return null;
      const response = await fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/corpus_category?name=${categoryName}`
      );
      const data = await response.json();
      return data?.length > 0 ? data[0]?.editable_level : null;
    },
    enabled: !!categoryName,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}
