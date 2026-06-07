import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeSubmission, submissionInclude } from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async (_req, userId) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    const submission = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.corpus_collection_submissions.update({
          where: { id },
          data: {
            review_status: "approved",
            visibility: "public",
            reviewed_by: userId,
            reviewed_at: new Date(),
            review_reason: null,
          },
          include: submissionInclude,
        });

        await tx.corpus_collection_messages.create({
          data: {
            user_id: updated.user_id,
            submission_id: updated.id,
            title: "审核通过",
            content: `你的作品「${updated.title}」已通过审核。`,
            type: "审核信息",
          },
        });

        return updated;
      },
      { timeout: 15_000 }
    );

    return NextResponse.json(serializeSubmission(submission));
  });
}
