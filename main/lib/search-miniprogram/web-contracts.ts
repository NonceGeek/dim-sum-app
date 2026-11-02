import { z } from "zod";
import { randomUUID } from "node:crypto";
import { SearchError } from "./contracts";
const input = z.object({
  q: z.string().trim().min(1).max(100),
  requestId: z.string().uuid().optional(),
  section: z.enum(["all", "primary", "semantic"]).optional(),
  semanticPart: z.enum(["all", "similar", "recommended"]).optional(),
  primaryCorpusId: z.union([z.literal("none"), z.string().regex(/^[1-9]\d*$/).max(16).refine(v => Number.isSafeInteger(Number(v)))]).optional(),
  similarCursor: z.string().regex(/^(0|[1-9]\d*)$/).max(8).optional(),
  recommendedCursor: z.string().regex(/^(0|[1-9]\d*)$/).max(8).optional(),
  dataset: z.string().min(1).max(500).optional(),
  contentAttribute: z.enum(["oral", "cultural_knowledge"]).optional(),
  mediaType: z.enum(["text", "audio", "video", "image", "model3d"]).optional(),
}).strict();
export function parseWebSearch(params: URLSearchParams) {
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new SearchError(400, "INVALID_SEARCH_REQUEST", "查询参数不能重复");
  const parsed = input.safeParse(Object.fromEntries(params));
  if (!parsed.success) throw new SearchError(400, "INVALID_SEARCH_REQUEST", "查询参数无效，请按新版接口文档提交");
  return { ...parsed.data, requestId: parsed.data.requestId ?? randomUUID() };
}
