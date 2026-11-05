import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { cancelTask, completeTask, issueSession } from "@/lib/ingestion/service";

/** POST /api/admin/ingestion-tasks/:id/{cancel|complete|session} */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const action = (await getStringRouteParam(context, "action")) ?? "";
    if (!id) throw new AccessError(400, "无效的任务 ID");
    const result =
      action === "cancel"
        ? await cancelTask(access, id)
        : action === "complete"
          ? await completeTask(access, id)
          : action === "session"
            ? await issueSession(access, id)
            : null;
    if (!result) throw new AccessError(404, "未知操作");
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  });
}
