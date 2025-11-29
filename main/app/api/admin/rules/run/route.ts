import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { RuleRunPayload, triggerAgentRule } from "@/lib/services/agent";

export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    let payload: RuleRunPayload;
    try {
      payload = (await req.json()) as RuleRunPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!payload.ruleText || !payload.ruleId || !payload.corpusName) {
      return NextResponse.json(
        { error: "ruleText, ruleId and corpusName are required" },
        { status: 400 }
      );
    }

    try {
      const result = await triggerAgentRule(payload);
      return NextResponse.json(result ?? { status: "queued" });
    } catch (error) {
      return handleAgentApiError(error, "Failed to trigger rule run");
    }
  });
}

