import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { getPlayerProgress } from "@/lib/services/yue-cube-game";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      return NextResponse.json(await getPlayerProgress(user.userId));
    } catch (error) {
      console.error("[YueCubeGame] Failed to load player progress", error);
      return NextResponse.json(
        { error: "Failed to load player progress" },
        { status: 500 }
      );
    }
  });
}
