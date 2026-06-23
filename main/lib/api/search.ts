import { useMutation, useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { fetchAllCategories, CategoryInfo } from "./category";
import { backendFetch } from "./backend";
import { api } from "./client";
import type { EntrySearchResponse } from "@/lib/search/entry-identity";

export type LyricsResult = {
  sec: number;
  data: string;
  pron: string;
};

export type SearchResult = {
  id: number;
  data: string;
  unique_id: string;
  note:
    | {
        context: {
          lyricist?: string;
          composer?: string;
          introduction?: string;
          song_name?: string;
          author?: string;
          album?: string;
          audio?: string;
          lyric?: LyricsResult[];
          page?: number;
          number?: string;
          others?: {
            異體?: any[];
            校訂註?: string | null;
          };
          pinyin?: string[];
          meaning?: string[];
        };
        contributor?: string;
      }
    | {
        context: {
          pron?: string;
          author?: string;
          video?: string;
          subtitle?: string;
          [key: string]: any;
        };
        contributor: string;
      };
  category: string;
  category_name?: string; // 原始分类名称
  created_at: string;
  tags: string[];
  editable_level: number;
};

type SearchParams = {
  keyword: string;
  category?: string;
};

type EntrySearchParams = {
  keyword: string;
  similarCursor?: string | null;
  recommendedCursor?: string | null;
};


/**
 * 根据 unique_id 获取单个语料库项目
 * @param uniqueId - 要获取的语料库项目的 unique_id
 * @returns 返回匹配的语料库项目
 */
export async function getCorpusItemByUniqueId(
  uniqueId: string,
  queryClient?: QueryClient
): Promise<SearchResult | null> {
  try {
    const response = await backendFetch(`/v2/corpus_item?unique_id=${uniqueId}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Corpus item with unique_id ${uniqueId} not found.`);
        return null;
      }
      throw new Error(
        `Failed to fetch corpus item with unique_id ${uniqueId}. Status: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const item = Array.isArray(data) ? data[0] : data;

    // 优先从 TanStack Query 缓存读取分类信息
    const allCategories = queryClient
      ? await queryClient.fetchQuery({
          queryKey: ['allCategories'],
          queryFn: fetchAllCategories,
          staleTime: Infinity,
        })
      : await fetchAllCategories();

    const categoryInfo = allCategories.find(cat => cat.name === item.category);

    return {
      ...item,
      category: categoryInfo?.nickname || item.category,
      editable_level: categoryInfo?.editable_level || 0
    };
  } catch (error) {
    console.error(
      `Error fetching corpus item with unique_id ${uniqueId}:`,
      error
    );
    throw error;
  }
}

export function useSearch() {
  const search = async (params: SearchParams) => {
    try {
      const params_category = JSON.parse(params.category);
      const table_name =
        params_category.includes("all") || !params_category.length
          ? ["cantonese_corpus_all"]
          : params.category;

      const response = await backendFetch(
        `/v2/text_search?table_name=${table_name}&column=data&keyword=${encodeURIComponent(
          params.keyword
        )}`,
        {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Search request failed");

      // 直接返回原始结果，category nickname 映射交给渲染层处理
      // 避免在 mutation 里额外 await categories，导致 isPending 时间虚长
      return (await response.json()) as SearchResult[];
    } catch (error) {
      console.error("Search failed:", error);
      throw error;
    }
  };

  return useMutation<SearchResult[], Error, SearchParams>({
    mutationFn: search,
  });
}

async function fetchSearch(params: SearchParams): Promise<SearchResult[]> {
  const params_category = JSON.parse(params.category);
  const table_name =
    params_category.includes("all") || !params_category.length
      ? ["cantonese_corpus_all"]
      : params.category;

  const response = await backendFetch(
    `/v2/text_search?table_name=${table_name}&column=data&keyword=${encodeURIComponent(
      params.keyword
    )}`,
    {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) throw new Error("Search request failed");
  return response.json();
}

/**
 * 带缓存的搜索 hook（useQuery）。
 * 同一个关键词 + dataset 组合，会话内只请求一次，结果缓存 5 分钟。
 */
export function useSearchQuery(keyword: string, category: string, enabled = true) {
  return useQuery<SearchResult[]>({
    queryKey: ["search", keyword, category],
    queryFn: () => fetchSearch({ keyword, category }),
    enabled: enabled && !!keyword,
    staleTime: 5 * 60 * 1000, // 5 分钟内同样的搜索词直接命中缓存
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

async function fetchEntrySearch({
  keyword,
  similarCursor,
  recommendedCursor,
}: EntrySearchParams): Promise<EntrySearchResponse> {
  const params = new URLSearchParams();
  params.set("q", keyword);
  if (similarCursor) params.set("similarCursor", similarCursor);
  if (recommendedCursor) params.set("recommendedCursor", recommendedCursor);

  return api.get<EntrySearchResponse>(`/api/search/entries?${params.toString()}`);
}

/**
 * 新语料身份搜索 hook。
 * 与旧 useSearchQuery 并行存在，便于三段式 UI 灰度接入。
 */
export function useEntrySearchQuery(
  keyword: string,
  options: {
    similarCursor?: string | null;
    recommendedCursor?: string | null;
    enabled?: boolean;
  } = {},
) {
  return useQuery<EntrySearchResponse>({
    queryKey: [
      "entry-search",
      keyword,
      options.similarCursor ?? null,
      options.recommendedCursor ?? null,
    ],
    queryFn: () =>
      fetchEntrySearch({
        keyword,
        similarCursor: options.similarCursor,
        recommendedCursor: options.recommendedCursor,
      }),
    enabled: (options.enabled ?? true) && !!keyword.trim(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export type { EntrySearchResponse };
