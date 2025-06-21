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

    // console.log("updateCorpusItem requst", {
    //   ...data,
    //   api_key: apiKey
    // });

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
        let errorMessage = 'API request failed';
        if (errorData && errorData.error) {
          switch (errorData.error) {
            case 'Invalid API key':
              errorMessage = 'Invalid API Key';
              break;
            case 'API key not approved':
              errorMessage = 'API Key Not Approved';
              break;
            case 'Corpus item not found':
              errorMessage = 'Corpus Item Not Found';
              break;
            default:
              errorMessage = errorData.error;
              break;
          }
        }
        throw new Error(errorMessage);
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
