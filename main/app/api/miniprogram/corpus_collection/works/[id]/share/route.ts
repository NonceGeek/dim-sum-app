import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SUBMISSION_WHERE,
  parseBigIntId,
} from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid work id" }, { status: 400 });

    const exists = await prisma.corpus_collection_submissions.findFirst({
      where: {
        id,
        OR: [{ user_id: user.userId }, PUBLIC_SUBMISSION_WHERE],
      },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json({ error: "Work not found" }, { status: 404 });
    }

    const submission = await prisma.corpus_collection_submissions.update({
      where: { id },
      data: { share_count: { increment: 1 } },
      select: { id: true, share_count: true },
    });

    return NextResponse.json({
      id: submission.id.toString(),
      shareCount: submission.share_count,
    });
  });
}
