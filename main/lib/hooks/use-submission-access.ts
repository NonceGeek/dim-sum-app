"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
export function useSubmissionAccess() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["submission-access", session?.user?.id],
    enabled: !!session?.user?.id,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const response = await fetch(
        "/api/admin/corpus-collection/submission-access",
        { cache: "no-store" },
      );
      if (!response.ok) return null;
      return response.json() as Promise<{
        isAdmin: boolean;
        canViewInsights: boolean;
        role: string;
        grants: Record<string, string[]>;
      }>;
    },
  });
}
