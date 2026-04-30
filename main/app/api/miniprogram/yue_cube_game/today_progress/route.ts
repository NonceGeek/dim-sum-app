import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { getTodayProgress } from "@/lib/services/yue-cube-game";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      return NextResponse.json(await getTodayProgress(user.userId));
    } catch (error) {
      console.error("[YueCubeGame] Failed to load today progress", error);
      return NextResponse.json(
        { error: "Failed to load today progress" },
        { status: 500 }
      );
    }
  });
}
