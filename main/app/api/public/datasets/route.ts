import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import { PUBLIC_LIST_CACHE_HEADERS } from "@/lib/public-cache";
import {
  listPublicDatasets,
  parsePublicDatasetQuery,
} from "@/lib/library/public-datasets";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const query = parsePublicDatasetQuery(new URL(req.url).searchParams);
    const result = await listPublicDatasets(query);
    return NextResponse.json(result, { headers: PUBLIC_LIST_CACHE_HEADERS });
  });
}
