import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { completeAgentTask } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

type SubmitPayload = {
  entries?: unknown[];
  selected?: unknown[];
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireMiniprogramMarker(req, async (_req, user) => {
    let payload: SubmitPayload = {};
    try {
      payload = (await req.json()) as SubmitPayload;
    } catch {
      payload = {};
    }

    const selections = Array.isArray(payload.selected)
      ? payload.selected
      : Array.isArray(payload.entries)
        ? payload.entries
        : [];

    if (selections.length === 0) {
      return NextResponse.json(
        { error: "entries or selected field is required" },
        { status: 400 }
      );
    }

    if (!user.userId) {
      return NextResponse.json(
        { error: "Missing user identifier" },
        { status: 400 }
      );
    }

    try {
      await completeAgentTask(params.id, {
        actorRef: user.userId,
          selected: selections,
      });

      return NextResponse.json({
        status: "success",
        message: "Task has been updated successfully.",
      });
    } catch (error) {
      return handleAgentApiError(error, "Failed to submit task");
    }
  });
}

