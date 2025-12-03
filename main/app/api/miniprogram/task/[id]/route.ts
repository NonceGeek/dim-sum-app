import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { fetchAgentTask } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function GET(
  req: NextRequest,
  context: AppRouteContext
) {
  return requireMiniprogramMarker(req, async () => {
    const taskId = await getStringRouteParam(context, "id");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      );
    }

    try {
      const task = await fetchAgentTask(taskId);
      return NextResponse.json(task);
    } catch (error) {
      return handleAgentApiError(error, "Failed to fetch task detail");
    }
  });
}

