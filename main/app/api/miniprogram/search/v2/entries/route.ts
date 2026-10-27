import { NextRequest, NextResponse } from "next/server";
import { handleEntrySearch } from "@/lib/search/entry-search-handler";
import type { EntrySearchResponse } from "@/lib/search/entry-identity";
import { toPublicSearch } from "@/lib/search-miniprogram/web-content";
import { parseWebSearch } from "@/lib/search-miniprogram/web-contracts";
import { SearchError } from "@/lib/search-miniprogram/contracts";
import { headers, failure } from "@/lib/search-miniprogram/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    const input = parseWebSearch(req.nextUrl.searchParams);
    // Use the same normalized query in search and analytics.
    const url = new URL(req.url); url.searchParams.set("q", input.q);
    const result = await handleEntrySearch(new NextRequest(url), { app: "search-app", requestId: input.requestId });
    if (!result.ok) throw new SearchError(result.status === 400 ? 400 : 503,
      result.status === 400 ? "INVALID_SEARCH_REQUEST" : "SERVICE_UNAVAILABLE", "查询暂不可用，请稍后重试");
    return NextResponse.json(toPublicSearch(await result.json() as EntrySearchResponse, input.requestId), { headers });
  } catch (error) { return failure(error); }
}
