import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { APP, parseSearch } from "@/lib/search-miniprogram/contracts";
import { searchEntries } from "@/lib/search-miniprogram/service";
import { failure, headers } from "@/lib/search-miniprogram/http";
import { recordServerEvent } from "@/lib/analytics/server";
export async function GET(req: NextRequest) {
  const started = performance.now();
  let parsed: ReturnType<typeof parseSearch> | undefined;
  try {
    parsed = parseSearch(req.nextUrl.searchParams);
    const p = parsed;
    const requestId = p.requestId ?? randomUUID();
    const result = await searchEntries(p.query, p.limit, p.cursor);
    const latencyMs = Math.round(performance.now() - started);
    after(() =>
      recordServerEvent("search_request", {
        app: APP,
        requestId,
        query: p.query,
        section: "all",
        primaryCount: result.direct.length,
        similarCount: result.related.length,
        recommendedCount: 0,
        paged: !!p.cursor,
        latencyMs,
      }),
    );
    return NextResponse.json(
      { query: p.query, requestId, ...result },
      { headers },
    );
  } catch (error) {
    if (parsed) {
      const p = parsed;
      after(() =>
        recordServerEvent("search_request", {
          app: APP,
          requestId: p.requestId ?? randomUUID(),
          query: p.query,
          section: "all",
          paged: !!p.cursor,
          error: "search_app_failed",
          latencyMs: Math.round(performance.now() - started),
        }),
      );
    }
    return failure(error);
  }
}
