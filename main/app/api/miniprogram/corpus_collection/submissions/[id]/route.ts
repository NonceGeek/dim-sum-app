import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import {
  getOptionalMiniprogramUser,
  requireMiniprogramAuth,
} from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SUBMISSION_WHERE,
  parseBigIntId,
  serializeSubmission,
  submissionInclude,
  updateCorpusSubmission,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  const user = await getOptionalMiniprogramUser(req);
  const id = parseBigIntId(await getStringRouteParam(context, "id"));
  if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });

  const submission = await prisma.corpus_collection_submissions.findFirst({
    where: {
      id,
      ...(user
        ? { OR: [{ user_id: user.userId }, PUBLIC_SUBMISSION_WHERE] }
        : PUBLIC_SUBMISSION_WHERE),
    },
    include: submissionInclude,
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  let viewerLiked = false;
  if (user) {
    const like = await prisma.corpus_collection_likes.findUnique({
      where: { submission_id_user_id: { submission_id: id, user_id: user.userId } },
      select: { id: true },
    });
    viewerLiked = Boolean(like);
  }

  return NextResponse.json(serializeSubmission(submission, viewerLiked, user?.userId));
}

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });

    try {
      const body = await req.json();
      const submission = await updateCorpusSubmission(user.userId, id, body);
      const editState = serializeSubmission(submission, undefined, user.userId);

      return NextResponse.json({
        id: submission.id.toString(),
        reviewStatus: submission.review_status,
        canEdit: editState.canEdit,
        editableUntil: editState.editableUntil,
        message: "修改已提交，等待审核",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update submission";
      if (message === "Submission not found") {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }
      if (message === "submission_edit_not_allowed") {
        return NextResponse.json({ error: "submission_edit_not_allowed" }, { status: 403 });
      }
      if (message === "Invalid media requirements") {
        return NextResponse.json({ error: "Invalid media requirements" }, { status: 422 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}

export async function DELETE() {
  return NextResponse.json(
    { error: "submission_delete_not_allowed" },
    { status: 405 }
  );
}
