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