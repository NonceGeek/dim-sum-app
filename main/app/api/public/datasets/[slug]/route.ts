import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { PUBLIC_LIST_CACHE_HEADERS } from "@/lib/public-cache";
import { getPublicDataset } from "@/lib/library/public-datasets";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return publicApi(req, async () => {
    const slug = await getStringRouteParam(context, "slug");
    const dataset = slug ? await getPublicDataset(slug) : null;
    if (!dataset)
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    return NextResponse.json(dataset, { headers: PUBLIC_LIST_CACHE_HEADERS });
  });
}
