import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { skipAgentTask } from "@/lib/services/agent";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireMiniprogramMarker(req, async (_req, user) => {
    if (!user.userId) {
      return NextResponse.json(
        { error: "Missing user identifier" },
        { status: 400 }
      );
    }

    try {
      await skipAgentTask(params.id, { actorRef: user.userId });

      return NextResponse.json({
        status: "success",
        message: "Task has been rejected and re-queued.",
      });
    } catch (error) {
      return handleAgentApiError(error, "Failed to cancel task");
    }
  });
}

