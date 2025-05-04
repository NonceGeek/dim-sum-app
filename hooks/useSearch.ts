import { useMutation } from "@tanstack/react-query";

export type SearchResult = {
  id: number;
  data: string;
  note: Array<{
    context: {
      pron?: string;
      author?: string;
      video?: string;
      subtitle?: string;
    };
    contributor: string;
  }>;
  category: string;
  created_at: string;
  tags: string[];
};

type SearchParams = {
  keyword: string;
};

export function useSearch() {
  // console.log("useSearch");
  return useMutation<SearchResult[], Error, SearchParams>({
    mutationFn: async (params: SearchParams) => {
      const response = await fetch(
        `https://bodhi-data.deno.dev/text_search_v2?table_name=cantonese_corpus_all&column=data&keyword=${encodeURIComponent(params.keyword)}`,
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

      return await response.json() as SearchResult[];
    },
  });
} 