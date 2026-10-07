"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export type LibraryOpsSummary = {
  isAdmin: boolean;
  actions: Array<"contribution_review" | "ingestion_assignee">;
  counts: {
    pendingInitialReview: number;
    myOpenLeads: number;
    openContactRequests: number;
  };
};

/** Library ops capabilities and sidebar badge counts; null when the user has none. */
export function useLibraryOps() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["library-ops", session?.user?.id],
    enabled: !!session?.user?.id,
    retry: false,
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/admin/library-ops", { cache: "no-store" });
      if (!response.ok) return null;
      return (await response.json()) as LibraryOpsSummary;
    },
  });
}
