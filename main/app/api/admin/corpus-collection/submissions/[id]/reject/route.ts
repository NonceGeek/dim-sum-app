import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeSubmission, submissionInclude } from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async (_req, userId) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const body = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    if (!body.reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });
    const submission = await prisma.$transaction(async (tx) => {
      const updated = await tx.corpus_collection_submissions.update({
        where: { id },
        data: {
          review_status: "rejected",
          visibility: "private",
          reviewed_by: userId,
          reviewed_at: new Date(),
          review_reason: body.reason,
        },
        include: submissionInclude,
      });

      await tx.corpus_collection_messages.create({
        data: {
          user_id: updated.user_id,
          submission_id: updated.id,
          title: "审核未通过",
          content: `你的作品「${updated.title}」未通过审核：${body.reason}`,
          type: "审核信息",
        },
      });

      return updated;
    });

    return NextResponse.json(serializeSubmission(submission));
  });
}
