import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

interface BasicInfo {
  appName: string;
  version: string;
  features: string[];
  lastUpdated: string;
  supportedLanguages: string[];
  contact: {
    website: string;
  };
}

export function useBasicInfo() {
  return useQuery<BasicInfo>({
    queryKey: ["basicInfo"],
    queryFn: () => api.get<BasicInfo>("/api/public/basic-info"),
  });
}

export function useHotTerms(count = 6) {
  return useQuery<string[]>({
    queryKey: ["hotTerms", count],
    queryFn: () =>
      api
        .get<{ terms: string[] }>(`/api/public/hot-terms?count=${count}`)
        .then((r) => r.terms ?? []),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
} 