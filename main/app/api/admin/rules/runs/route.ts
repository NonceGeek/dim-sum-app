import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAgentRuns } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;

  const query = {
    page: parseNumber(searchParams.get("page"), 1),
    pageSize: parseNumber(searchParams.get("pageSize"), 10),
    status: searchParams.get("status") || undefined,
    ruleId: searchParams.get("ruleId") || undefined,
    corpusName: searchParams.get("corpusName") || undefined,
  };

  return requireAdmin(req, async () => {
    try {
      const data = await fetchAgentRuns(query);
      return NextResponse.json(data);
    } catch (error) {
      return handleAgentApiError(error, "Failed to load rule runs");
    }
  });
}

