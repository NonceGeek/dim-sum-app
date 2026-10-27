import { NextRequest, NextResponse } from "next/server";
import { getDailyEntry } from "@/lib/search-miniprogram/daily-entry-store";
import { SearchError } from "@/lib/search-miniprogram/contracts";
import { failure, headers } from "@/lib/search-miniprogram/http";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    // Only the server chooses the day and entry; no date/user override exists.
    if ([...req.nextUrl.searchParams].length)
      throw new SearchError(400, "INVALID_DAILY_REQUEST", "今日内容接口不接受查询参数");
    return NextResponse.json(await getDailyEntry(), { headers });
  } catch (error) {
    return failure(error);
  }
}
