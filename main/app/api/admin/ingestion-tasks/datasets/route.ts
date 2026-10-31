import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { datasetOverview, listDatasets } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/datasets[?name=]：带 name 时返回该语料集的条数与媒体组成 */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    const name = new URL(req.url).searchParams.get("name")?.trim();
    return NextResponse.json(name ? await datasetOverview(access, name) : await listDatasets(access), {
      headers: PRIVATE_HEADERS,
    });
  });
}
