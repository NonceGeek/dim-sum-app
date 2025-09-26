export interface CorpusItem {
  id: number;
  data: string;
  note?: any;
  category?: string;
  created_at: Date;
  unique_id: string;
  tags?: any;
  editable_level: number;
  liked_num: number;
  bookmark_num: number;
  view_num: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CorpusItemsResponse {
  data: CorpusItem[];
  pagination: PaginationInfo;
}

export interface EditableItem {
  id: number;
  word: string;
  unique_id: string;
  category: string;
  created_at: string;
  updated_at: string;
  source: string;
}

export interface EditableItemsResponse {
  data: EditableItem[];
}

export interface CreateCorpusItemRequest {
  data: string;
  category?: string;
  note: {
    pinyin: string[];
    meaning: string[];
    sentence: string[];
    related_documents: { name: string; link: string }[];
    video_clips: { name: string; link: string }[];
  };
}

export interface CreateCorpusItemResponse {
  success: boolean;
  history_id: string;
  unique_id: string;
  status: string;
}

export interface BatchCreateRequest {
  data: Array<{
    data: string;
    category?: string;
    pinyin: string[];
    meaning: string[];
    sentence: string[];
    related_documents: { name: string; link: string }[];
    video_clips: { name: string; link: string }[];
  }>;
}

export interface BatchCreateResponse {
  success: boolean;
  count: number;
  records: Array<{
    history_id: string;
    unique_id: string;
    data: string;
  }>;
}

export const dataAnnotationApi = {
  getCorpusItems: async (page: number = 1, limit: number = 20, q?: string): Promise<CorpusItemsResponse> => {
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (q) {
        searchParams.append('q', q);
      }
      
      const response = await fetch(`/api/marker/corpus/items?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch corpus items');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch corpus items');
    }
  },

  getEditableItems: async (): Promise<EditableItemsResponse> => {
    try {
      const response = await fetch('/api/marker/corpus/editable-items', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch editable items');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch editable items');
    }
  },

  createCorpusItem: async (data: CreateCorpusItemRequest): Promise<CreateCorpusItemResponse> => {
    try {
      const response = await fetch('/api/data-annotation/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create corpus item');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create corpus item');
    }
  },

  batchCreateCorpusItems: async (data: BatchCreateRequest): Promise<BatchCreateResponse> => {
    try {
      const response = await fetch('/api/data-annotation/batch-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to batch create corpus items');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to batch create corpus items');
    }
  },
};

export default dataAnnotationApi;
