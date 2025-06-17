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