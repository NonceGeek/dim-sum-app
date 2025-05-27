type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, config: RequestConfig = {}): Promise<T> {
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  const response = await fetch(url, {
    method: config.method || 'GET',
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    switch (response.status) {
      case 401:
        window.location.href = '/auth/signin';
        throw new ApiError(401, 'Unauthorized');
      case 403:
        throw new ApiError(403, 'Permission denied');
      case 404:
        throw new ApiError(404, 'Resource not found');
      default:
        throw new ApiError(response.status, 'API request failed');
    }
  }

  return response.json();
}

export const api = {
  get: <T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>) => 
    request<T>(url, { ...config, method: 'GET' }),

  post: <T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method'>) =>
    request<T>(url, { ...config, method: 'POST', body: data }),

  put: <T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'method'>) =>
    request<T>(url, { ...config, method: 'PUT', body: data }),

  delete: <T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(url, { ...config, method: 'DELETE' }),
};

export default api; 