import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SUBMISSION_WHERE,
  parseBigIntId,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });

    const submission = await prisma.corpus_collection_submissions.findFirst({
      where: {
        id,
        OR: [{ user_id: user.userId }, PUBLIC_SUBMISSION_WHERE],
      },
      include: submissionInclude,
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const like = await prisma.corpus_collection_likes.findUnique({
      where: { submission_id_user_id: { submission_id: id, user_id: user.userId } },
      select: { id: true },
    });

    return NextResponse.json(serializeSubmission(submission, Boolean(like)));
  });
}
