import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { reviewPicvoiceGame } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { createGameAnswerRecord } from "@/lib/services/yue-cube-game";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const body = await req.json();
      const scene = typeof body.scene === "string" ? body.scene : "";
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
      const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl : "";
      const timeSpent =
        typeof body.time === "number" && Number.isFinite(body.time)
          ? Math.max(0, Math.floor(body.time))
          : null;

      if (!scene || !imageUrl || !audioUrl) {
        return NextResponse.json(
          { error: "Missing required fields: scene, imageUrl, audioUrl" },
          { status: 400 }
        );
      }

      const result = await reviewPicvoiceGame({ scene, imageUrl, audioUrl });

      await createGameAnswerRecord({
        userId: user.userId,
        mode: "image",
        scene,
        imageUrl,
        audioUrl,
        timeSpentSeconds: timeSpent,
        isCorrect: result.overallPass,
        agentResult: result as unknown as Prisma.InputJsonValue,
      });

      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to review picvoice answer");
    }
  });
}
