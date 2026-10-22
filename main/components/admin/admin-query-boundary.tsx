"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
/** Never reuse one user's/scope's cached business data in another scope. */
export function AdminQueryBoundary({
  identity,
  children,
}: {
  identity: string;
  children: ReactNode;
}) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: false } },
      }),
    [identity],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
