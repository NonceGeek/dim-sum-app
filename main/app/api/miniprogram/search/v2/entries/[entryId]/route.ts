import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";
import { toPublicEntry } from "@/lib/search-miniprogram/web-content";
import { SearchError } from "@/lib/search-miniprogram/contracts";
import { headers, failure } from "@/lib/search-miniprogram/http";
export const runtime = "nodejs";
export async function GET(_req: NextRequest, context: AppRouteContext) {
  try {
    const id = await getStringRouteParam(context, "entryId");
    if (!z.string().uuid().safeParse(id).success) throw new SearchError(400, "INVALID_ENTRY_ID", "内容标识无效");
    const entry = await fetchEntryIdentityByUniqueId(id!);
    if (!entry) throw new SearchError(404, "ENTRY_UNAVAILABLE", "该内容暂不可用");
    return NextResponse.json({ schemaVersion: 2, entry: toPublicEntry(entry) }, { headers });
  } catch (error) { return failure(error); }
}
