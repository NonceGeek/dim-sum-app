import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { compileAgentRule } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    let body: { ruleText?: string };
    try {
      body = (await req.json()) as { ruleText?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!body.ruleText) {
      return NextResponse.json({ error: "ruleText is required" }, { status: 400 });
    }

    try {
      const result = await compileAgentRule(body.ruleText);
      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to compile rule");
    }
  });
}

