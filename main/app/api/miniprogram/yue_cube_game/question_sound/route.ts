import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  getSoundQuestions,
  parseQuestionLimit,
} from "@/lib/services/yue-cube-game";

export async function GET(req: NextRequest) {
  const limit = parseQuestionLimit(new URL(req.url).searchParams.get("limit"));

  return requireMiniprogramAuth(req, async () => {
    try {
      return NextResponse.json(await getSoundQuestions(limit));
    } catch (error) {
      console.error("[YueCubeGame] Failed to load sound questions", error);
      return NextResponse.json(
        { error: "Failed to load sound questions" },
        { status: 500 }
      );
    }
  });
}
