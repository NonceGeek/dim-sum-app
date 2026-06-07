import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  jsonInput,
  parseBigIntId,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const isAwarded = typeof body.isAwarded === "boolean" ? body.isAwarded : undefined;
    const awardStatus = typeof body.awardStatus === "string" ? body.awardStatus : undefined;
    const awardInfo = jsonInput(body.awardInfo ?? {});

    const submission = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.corpus_collection_submissions.update({
          where: { id },
          data: {
            is_awarded: isAwarded,
            award_status: awardStatus,
            award_info: awardInfo,
          },
          include: submissionInclude,
        });

        if (isAwarded === true) {
          await tx.corpus_collection_messages.create({
            data: {
              user_id: updated.user_id,
              submission_id: updated.id,
              title: "中奖通知",
              content: `你的作品「${updated.title}」已被标记为获奖作品。`,
              type: "中奖信息",
            },
          });
        }

        return updated;
      },
      { timeout: 15_000 }
    );

    return NextResponse.json(serializeSubmission(submission));
  });
}
