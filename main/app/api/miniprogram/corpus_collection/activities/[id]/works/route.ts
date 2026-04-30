import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  listPublicSubmissions,
  parseBigIntId,
  parsePositiveInt,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);
  const sort = searchParams.get("sort") === "likes" ? "likes" : "latest";

  return requireMiniprogramAuth(req, async () => {
    const activityId = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!activityId) {
      return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
    }

    return NextResponse.json(
      await listPublicSubmissions({ activityId, page, pageSize, sort })
    );
  });
}
