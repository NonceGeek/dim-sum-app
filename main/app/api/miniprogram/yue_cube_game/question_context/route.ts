import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  getContextQuestions,
  parseQuestionLimit,
} from "@/lib/services/yue-cube-game";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const sceneId = searchParams.get("scene_id");
  const limit = parseQuestionLimit(searchParams.get("limit"));

  return requireMiniprogramAuth(req, async () => {
    try {
      return NextResponse.json(await getContextQuestions(sceneId, limit));
    } catch (error) {
      console.error("[YueCubeGame] Failed to load context questions", error);
      return NextResponse.json(
        { error: "Failed to load context questions" },
        { status: 500 }
      );
    }
  });
}
