import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedMissingTags } from "@/lib/taxonomy/tag-embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Worst case is 8 rounds of 3 relay calls at the 6 s timeout, which fits inside maxDuration.
const BATCH_SIZE = 24;

// Invoked daily by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await embedMissingTags(prisma, BATCH_SIZE);
  if (result.failed.length) {
    console.error("Tag embedding sweep had failures", { failed: result.failed });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
