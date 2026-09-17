import type { SearchResult } from "./search";

export interface CorpusNote {
  meaning?: string[];
  pinyin?: string[];
  contributor: string;
  [key: string]: any; // 支持其他动态字段
}

export interface CorpusItem {
  uuid: string;
  note: CorpusNote;
}

export interface UpdateCorpusData {
  uuid: string;
  note: CorpusNote;
  category: string;
}

export interface UpdateCorpusResponse {
  message: string;
  history_id?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const editApi = {
  getCorpusItem: async (uuid: string): Promise<SearchResult | null> => {
    const response = await fetch(`/api/marker/corpus/items/${encodeURIComponent(uuid)}`, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error((await response.json()).error || "Failed to load corpus item");
    return response.json();
  },

  updateCorpusItem: async (data: UpdateCorpusData): Promise<UpdateCorpusResponse> => {
    try {
      const response = await fetch('/api/marker/corpus/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: data.uuid,
          note: data.note,
          category: data.category
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update corpus item');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update corpus item');
    }
  },

};

export default editApi;
