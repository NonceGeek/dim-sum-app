import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { moderateGameImage } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const body = await req.json();
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";

      if (!imageUrl) {
        return NextResponse.json(
          { error: "Missing required field: imageUrl" },
          { status: 400 }
        );
      }

      return NextResponse.json(await moderateGameImage(imageUrl));
    } catch (error) {
      return handleAgentApiError(error, "Failed to moderate image");
    }
  });
}
