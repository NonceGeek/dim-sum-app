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
    try {
      const response = await fetch('/api/marker/corpus/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: data.uuid,
          note: data.note
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
