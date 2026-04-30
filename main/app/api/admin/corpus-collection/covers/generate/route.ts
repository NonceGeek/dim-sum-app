import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { generateCorpusCollectionCovers } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const body = await req.json();
      if (!body.prompt) {
        return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      }
      return NextResponse.json(await generateCorpusCollectionCovers(body.prompt));
    } catch (error) {
      return handleAgentApiError(error, "Failed to generate covers");
    }
  });
}
