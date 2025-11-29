import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAgentDescriptors } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const data = await fetchAgentDescriptors();
      return NextResponse.json(data);
    } catch (error) {
      return handleAgentApiError(error, "Failed to load agents");
    }
  });
}

