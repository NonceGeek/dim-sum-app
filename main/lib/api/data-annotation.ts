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

export const dataAnnotationApi = {
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
};

export default dataAnnotationApi;
