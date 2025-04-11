import { useMutation } from "@tanstack/react-query";

export type SearchResult = {
  dataset_id: string;
  results: {
    id: string;
    content: string;
    abstract: string;
    creator: string;
    id_on_chain: string;
  }[];
};

type SearchParams = {
  text: string;
  dataset: string;
};

type SearchResponse = {
  id: string;
  content: string;
  creator: string;
  id_on_chain: string;
}[];

export function useSearch() {
  return useMutation<SearchResult[], Error, SearchParams>({
    mutationFn: async (params: SearchParams) => {
      const response = await fetch("https://embedding-search.deno.dev/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json() as SearchResponse;
      
      const resultsWithAbstract = data.map((item) => {
        const firstNewLineIndex = item.content.indexOf("\n");
        const abstract = firstNewLineIndex !== -1 
          ? item.content.substring(0, firstNewLineIndex) 
          : item.content;
        return {
          id: item.id,
          content: item.content,
          abstract,
          creator: item.creator,
          id_on_chain: item.id_on_chain,
        };
      });

      return [{
        dataset_id: params.dataset,
        results: resultsWithAbstract,
      }];
    },
  });
} 