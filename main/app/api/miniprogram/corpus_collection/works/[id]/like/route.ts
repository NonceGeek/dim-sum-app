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

    const body = await req.json().catch(() => ({}));
    const liked = body.liked !== false;

    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.corpus_collection_submissions.findFirst({
        where: {
          id,
          OR: [{ user_id: user.userId }, PUBLIC_SUBMISSION_WHERE],
        },
        select: { id: true },
      });
      if (!submission) {
        return null;
      }

      if (liked) {
        await tx.corpus_collection_likes.upsert({
          where: { submission_id_user_id: { submission_id: id, user_id: user.userId } },
          create: { submission_id: id, user_id: user.userId },
          update: {},
        });
      } else {
        await tx.corpus_collection_likes.deleteMany({
          where: { submission_id: id, user_id: user.userId },
        });
      }

      const likeCount = await tx.corpus_collection_likes.count({
        where: { submission_id: id },
      });
      await tx.corpus_collection_submissions.update({
        where: { id },
        data: { like_count: likeCount },
      });
      return likeCount;
    });

    if (result === null) {
      return NextResponse.json({ error: "Work not found" }, { status: 404 });
    }

    return NextResponse.json({ liked, likeCount: result });
  });
}
