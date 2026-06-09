'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { type ReactNode } from 'react';

/**
 * 模块级单例 QueryClient。
 *
 * 原先用 useState 创建，导致每次 Suspense boundary（如 AuthProvider 里的 useSearchParams）
 * 触发子树卸载/重挂时，queryClient 被重新实例化，缓存清零，从而引发重复请求。
 *
 * 改为模块级单例后，无论组件树卸载重挂多少次，始终复用同一个 queryClient 实例。
 * 注意：此文件标记为 'use client'，不会在 SSR 中执行，因此不存在跨请求共享的问题。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,       // 1 minute
      gcTime: 5 * 60 * 1000,      // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};
