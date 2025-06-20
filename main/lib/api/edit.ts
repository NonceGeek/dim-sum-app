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
}

export interface UpdateCorpusResponse {
  message: string;
  history_id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const editApi = {

  updateCorpusItem: async (data: UpdateCorpusData): Promise<UpdateCorpusResponse> => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key not found in environment variables');
    }

    // 打印要发送的整个包体
    console.log("updateCorpusItem payload", {
      ...data,
      api_key: apiKey
    });

    try {
      const response = await fetch('https://dim-sum-prod.deno.dev/dev/insert_corpus_item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          api_key: apiKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
