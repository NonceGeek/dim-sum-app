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
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key not found in environment variables');
    }

    try {
      const response = await fetch('https://dim-sum-prod.deno.dev/dev/editable_items', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
      throw new Error('Failed to fetch editable items');
    }
  },
};

export default dataAnnotationApi;
