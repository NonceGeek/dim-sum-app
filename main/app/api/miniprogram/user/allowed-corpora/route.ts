import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { getUserCorpusList } from "@/lib/permission";

export async function GET(req: NextRequest) {
  return requireMiniprogramMarker(req, async (_req, user) => {
    if (!user.userId) {
      return NextResponse.json(
        { error: "Missing user identifier" },
        { status: 400 },
      );
    }

    const allowedCorpora = await getUserCorpusList(user.userId);
    return NextResponse.json(allowedCorpora);
  });
}
