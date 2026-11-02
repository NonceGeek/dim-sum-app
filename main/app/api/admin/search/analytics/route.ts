import { NextRequest, NextResponse } from "next/server";
import { withSearchAdmin as requireAdmin } from "@/lib/search-miniprogram/admin";
import { parseDays, searchAnalytics } from "@/lib/search-miniprogram/analytics";
import { SearchError } from "@/lib/search-miniprogram/contracts";
import { failure, headers } from "@/lib/search-miniprogram/http";
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const range = parseDays(
        req.nextUrl.searchParams.get("from"),
        req.nextUrl.searchParams.get("to"),
      );
      if (!range)
        throw new SearchError(
          400,
          "INVALID_RANGE",
          "请选择不超过 31 天的有效日期范围",
        );
      return NextResponse.json(
        { data: await searchAnalytics(range.start, range.end) },
        { headers },
      );
    } catch (error) {
      return failure(error);
    }
  });
}
