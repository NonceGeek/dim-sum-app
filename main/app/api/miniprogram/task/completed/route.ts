import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { fetchAgentTasks } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

const DEFAULT_STATUS = "completed";

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

      return NextResponse.json(data);
    } catch (error) {
      return handleAgentApiError(error, "Failed to load completed tasks");
    }
  });
}

