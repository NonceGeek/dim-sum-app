import { z } from "zod";
import { createHash } from "node:crypto";
export const APP = "search-app" as const;
import { feedbackTypes, feedbackStatuses } from "./ui-options";
export { feedbackTypes, feedbackStatuses } from "./ui-options";
export const feedbackInput = z
  .object({
    requestId: z.string().uuid(),
    anonymousId: z.string().uuid(),
    type: z.enum(feedbackTypes),
    description: z.string().trim().min(1).max(300),
    entryId: z.string().uuid().optional(),
  })
  .strict();
export const feedbackUpdate = z
  .object({
    id: z.string().uuid(),
    status: z.enum(feedbackStatuses),
    note: z.string().trim().max(1000),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export class SearchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const scopeHash = (query: string) =>
  createHash("sha256")
    .update(`search-app:v1:${query}`)
    .digest("hex")
    .slice(0, 24);
export function encodeCursor(query: string, rank: number, id: bigint) {
  return Buffer.from(
    JSON.stringify({ q: scopeHash(query), r: rank, i: String(id) }),
  ).toString("base64url");
}
export function decodeCursor(query: string, raw: string | null) {
  if (!raw) return null;
  try {
    const value = z
      .object({
        q: z.literal(scopeHash(query)),
        r: z.number().int().min(0).max(1),
        i: z
          .string()
          .regex(/^[1-9]\d*$/)
          .max(19),
      })
      .strict()
      .parse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    if (BigInt(value.i) > BigInt("9223372036854775807")) throw new Error();
    return { rank: value.r, id: BigInt(value.i) };
  } catch {
    throw new SearchError(400, "INVALID_CURSOR", "翻页参数无效，请重新查询");
  }
}
export function parseSearch(params: URLSearchParams) {
  const query = params.get("q")?.trim() ?? "";
  if (!query || query.length > 100)
    throw new SearchError(400, "INVALID_QUERY", "请输入 1–100 字的查询内容");
  const rawLimit = params.get("limit") ?? "20";
  if (!/^(?:[1-9]|1[0-9]|20)$/.test(rawLimit))
    throw new SearchError(400, "INVALID_LIMIT", "每页数量须为 1–20");
  const requestId = params.get("requestId");
  if (requestId && !z.string().uuid().safeParse(requestId).success)
    throw new SearchError(400, "INVALID_REQUEST_ID", "查询标识无效");
  const raw = params.get("cursor");
  if (raw && raw.length > 300)
    throw new SearchError(400, "INVALID_CURSOR", "翻页参数无效");
  return {
    query,
    limit: Number(rawLimit),
    cursor: decodeCursor(query, raw),
    requestId,
  };
}
export function sameFeedback(
  existing: {
    anonymous_id: string;
    user_id: string | null;
    entry_id: string | null;
    type: string;
    description: string;
  },
  input: z.infer<typeof feedbackInput>,
  userId: string | null,
) {
  return (
    existing.anonymous_id === input.anonymousId &&
    existing.user_id === userId &&
    existing.entry_id === (input.entryId ?? null) &&
    existing.type === input.type &&
    existing.description === input.description
  );
}
