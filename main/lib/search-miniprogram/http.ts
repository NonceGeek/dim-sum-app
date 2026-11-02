import { NextResponse } from "next/server";
import { SearchError } from "./contracts";
export const headers = { "Cache-Control": "private, no-store" };
export function failure(error: unknown) {
  if (error instanceof SearchError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: {
          ...headers,
          ...(error.status === 429 ? { "Retry-After": "600" } : {}),
        },
      },
    );
  console.error(
    "search-app request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "服务暂不可用，请稍后重试",
      },
    },
    { status: 503, headers },
  );
}
export async function readJson(req: Request) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 4096)
    throw new SearchError(413, "BODY_TOO_LARGE", "请求内容过长");
  try {
    return JSON.parse(raw);
  } catch {
    throw new SearchError(400, "INVALID_JSON", "请求格式有误");
  }
}
