import { useMutation } from "@tanstack/react-query";
import { fetchAllCategories, CategoryInfo } from "./category";

export type SearchResult = {
  id: number;
  data: string;
  unique_id: string;
  note:
    | {
        context: {
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
  created_at: string;
  tags: string[];
  editable_level: number;
};

type SearchParams = {
  keyword: string;
};


/**
 * 根据 unique_id 获取单个语料库项目
 * @param uniqueId - 要获取的语料库项目的 unique_id
 * @returns 返回匹配的语料库项目
 */
export async function getCorpusItemByUniqueId(
  uniqueId: string
): Promise<SearchResult | null> {
  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_BACKEND_URL + `/corpus_item?unique_id=${uniqueId}`
    );

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

    // 获取分类信息
    const allCategories = await fetchAllCategories();
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
  // console.log("useSearch");
  const search = async (params: SearchParams) => {
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/text_search_v2?table_name=cantonese_corpus_all&column=data&keyword=${encodeURIComponent(
            params.keyword
          )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = (await response.json()) as SearchResult[];

      // 获取全量分类信息
      const allCategories = await fetchAllCategories();
      
      // 创建分类名称到分类信息的映射
      const categoryMap = new Map<string, CategoryInfo>();
      allCategories.forEach(cat => {
        categoryMap.set(cat.name, cat);
      });

      // 更新搜索结果，匹配分类信息并添加 editable_level
      const updatedData = data.map((result) => {
        const categoryInfo = categoryMap.get(result.category);
        return {
          ...result,
          category: categoryInfo?.nickname || result.category, // 使用 nickname 作为显示名称
          editable_level: categoryInfo?.editable_level || 0, // 添加 editable_level
        };
      });

      return updatedData;
    } catch (error) {
      console.error("Search failed:", error);
      throw error;
    }
  };

  return useMutation<SearchResult[], Error, SearchParams>({
    mutationFn: search,
  });
}
