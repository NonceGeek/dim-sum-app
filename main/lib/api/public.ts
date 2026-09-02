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

/** Fixed trending phrases shown on the homepage and search empty states. */
export const HOT_TERMS = [
  "帆船（哥德堡一号）",
  "行",
  "鹅鹅鹅， 曲项向天歌",
  "落花流水",
  "Peppa",
  "月光光，照地堂",
  "亚姨",
] as const; 