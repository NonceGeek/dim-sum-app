import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAuth } from "@/lib/auth";
import { completeAgentTask } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

type SubmitPayload = {
  entries?: unknown[];
  selected?: unknown[];
};

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAuth(req, async (_req, userId) => {
    const taskId = await getStringRouteParam(context, "id");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      );
    }

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

    try {
      const result = await completeAgentTask(taskId, {
        actorRef: userId,
        selected: selections,
      });

      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to submit task");
    }
  });
}
