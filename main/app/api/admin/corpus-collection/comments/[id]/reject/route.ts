import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId } from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });

    const comment = await prisma.$transaction(async (tx) => {
      const updated = await tx.corpus_collection_comments.update({
        where: { id },
        data: { status: "rejected" },
      });
      const commentCount = await tx.corpus_collection_comments.count({
        where: { submission_id: updated.submission_id, status: "approved" },
      });
      await tx.corpus_collection_submissions.update({
        where: { id: updated.submission_id },
        data: { comment_count: commentCount },
      });
      return updated;
    });

    return NextResponse.json({
      id: comment.id.toString(),
      status: comment.status,
    });
  });
}
