import { NextRequest, NextResponse } from "next/server";
import { AppRouteContext, getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { viewAgentTask } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

interface ViewTaskPayload {
  actorRef: string;
}

export async function POST(
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
      const payload: ViewTaskPayload = await req.json();
      
      if (!payload.actorRef) {
        return NextResponse.json(
          { error: "Missing actorRef" },
          { status: 400 }
        );
      }

      const result = await viewAgentTask(taskId, {
        actorRef: payload.actorRef,
      });

      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to mark task as viewed");
    }
  });
}
