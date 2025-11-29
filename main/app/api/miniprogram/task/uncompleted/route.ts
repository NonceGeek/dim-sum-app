import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { fetchAgentTasks } from "@/lib/services/agent";
import { mapTasksToList } from "@/lib/miniprogram-task-mapper";
import { handleAgentApiError } from "@/lib/services/agent-error";

const DEFAULT_STATUS = "created,notified,in_progress,reassigning";

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status") || DEFAULT_STATUS;
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = parseNumber(searchParams.get("pageSize"), 10);

  return requireMiniprogramMarker(req, async (_req, user) => {
    if (!user.userId) {
      return NextResponse.json(
        { error: "Missing user identifier" },
        { status: 400 }
      );
    }

    try {
      const data = await fetchAgentTasks({
        actorRef: user.userId,
        status,
        page,
        pageSize,
      });

      const response = NextResponse.json(mapTasksToList(data.items));
      response.headers.set("x-pagination-page", String(data.pagination.page));
      response.headers.set("x-pagination-page-size", String(data.pagination.pageSize));
      response.headers.set("x-pagination-total", String(data.pagination.total));
      return response;
    } catch (error) {
      return handleAgentApiError(error, "Failed to load pending tasks");
    }
  });
}

