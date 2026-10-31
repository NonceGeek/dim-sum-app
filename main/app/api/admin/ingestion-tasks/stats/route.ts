import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { taskStats } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/stats?assignee=me|all：列表顶部的统计卡片 */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) =>
    NextResponse.json(await taskStats(access, new URL(req.url).searchParams), {
      headers: PRIVATE_HEADERS,
    }),
  );
}
