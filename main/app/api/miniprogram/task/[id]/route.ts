import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { fetchAgentTask } from "@/lib/services/agent";
import { mapTaskToEntries, mapTaskToListItem } from "@/lib/miniprogram-task-mapper";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireMiniprogramMarker(req, async () => {
    try {
      const task = await fetchAgentTask(params.id);
      const listItem = mapTaskToListItem(task);

      return NextResponse.json({
        taskId: listItem.taskId,
        taskName: listItem.taskName,
        status: listItem.status,
        entries: mapTaskToEntries(task),
      });
    } catch (error) {
      return handleAgentApiError(error, "Failed to fetch task detail");
    }
  });
}

