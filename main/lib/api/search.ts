import { useMutation } from "@tanstack/react-query";

export type SearchResult = {
  id: number;
  data: string;
  unique_id: string;
  note: {
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
  } | {
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
};

type SearchParams = {
  keyword: string;
};

const fetchCategory = async (categoryName: string) => {
  console.log("fetchCategory", categoryName);
  try {
    const response = await fetch(`https://dim-sum-prod.deno.dev/corpus_category?name=${categoryName}`);
    const data = await response.json();
    // get the first item of data
    const firstItem = data[0];
    if (firstItem && firstItem.nickname) {
      console.log("firstItem.nickname", firstItem.nickname);
      return firstItem.nickname;
    } else {
      return categoryName; // Fallback to the original category name
    }
  } catch (error) {
    console.error("Error fetching category:", error);
    return categoryName; // Fallback to the original category name on error
  }
};

/**
 * 根据 unique_id 获取单个语料库项目
 * @param uniqueId - 要获取的语料库项目的 unique_id
 * @returns 返回匹配的语料库项目
 */
export async function getCorpusItemByUniqueId(uniqueId: string): Promise<SearchResult | null> {
  try {
    const response = await fetch(`https://dim-sum-prod.deno.dev/corpus_item?unique_id=${uniqueId}`);

    if (!response.ok) {

      if (response.status === 404) {
        console.warn(`Corpus item with unique_id ${uniqueId} not found.`);
        return null;
      }
      throw new Error(`Failed to fetch corpus item with unique_id ${uniqueId}. Status: ${response.status}`);
    }

    const data = await response.json();


    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const item = Array.isArray(data) ? data[0] : data;

    const realCategory = await fetchCategory(item.category);
    return { ...item, category: realCategory };

  } catch (error) {
    console.error(`Error fetching corpus item with unique_id ${uniqueId}:`, error);
    throw error;
  }
}

export function useSearch() {
  // console.log("useSearch");
  const search = async (params: SearchParams) => {
    try {
      const response = await fetch(
        `https://dim-sum-prod.deno.dev/text_search_v2?table_name=cantonese_corpus_all&column=data&keyword=${encodeURIComponent(params.keyword)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json() as SearchResult[];

      // Fetch the real category for each data item
      const updatedData = await Promise.all(
        data.map(async (result) => {
          const realCategory = await fetchCategory(result.category);
          return { ...result, category: realCategory };
        })
      );

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