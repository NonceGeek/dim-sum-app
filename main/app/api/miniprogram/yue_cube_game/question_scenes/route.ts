import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  getQuestionScenes,
  type YueCubeGameMode,
} from "@/lib/services/yue-cube-game";

const modes = new Set(["context", "sound", "image"]);

export async function GET(req: NextRequest) {
  const mode = new URL(req.url).searchParams.get("mode") ?? "";

  if (!modes.has(mode)) {
    return NextResponse.json(
      { error: "Invalid mode. Expected context, sound, or image." },
      { status: 400 }
    );
  }

  return requireMiniprogramAuth(req, async () => {
    try {
      return NextResponse.json(await getQuestionScenes(mode as YueCubeGameMode));
    } catch (error) {
      console.error("[YueCubeGame] Failed to load scenes", error);
      return NextResponse.json(
        { error: "Failed to load scenes" },
        { status: 500 }
      );
    }
  });
}
