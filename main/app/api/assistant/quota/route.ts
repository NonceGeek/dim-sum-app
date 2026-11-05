import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getQuota } from "@/lib/assistant/quota";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (_req, userId) =>
    NextResponse.json(await getQuota(userId), {
      headers: { "Cache-Control": "no-store" },
    }),
  );
}
