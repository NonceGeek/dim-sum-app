import { withAdminAccess } from "@/lib/admin/access";
import { assertCoverAccess } from "@/lib/admin/cover-access";
import { AccessError } from "@/lib/admin/security";
import { generateCorpusCollectionCovers } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { NextRequest,NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    try {
      const body = await req.json();
      await assertCoverAccess(access, body, db);
      if (!body.prompt) {
        return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      }
      return NextResponse.json(await generateCorpusCollectionCovers(body.prompt));
    } catch (error) {
      if (error instanceof AccessError) throw error;
      return handleAgentApiError(error, "Failed to generate covers");
    }
  });
}
