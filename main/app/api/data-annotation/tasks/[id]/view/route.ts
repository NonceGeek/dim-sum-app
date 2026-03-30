import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAuth } from "@/lib/auth";
import { viewAgentTask } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAuth(req, async (_req, userId) => {
    const taskId = await getStringRouteParam(context, "id");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      );
    }

    try {
      const result = await viewAgentTask(taskId, { actorRef: userId });
      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to mark task as viewed");
    }
  });
}
