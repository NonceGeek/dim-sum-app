import { withAdminAccess, assertScope } from "@/lib/admin/access";
import { canActivityAction } from "@/lib/admin/policy";
import { AccessError } from "@/lib/admin/security";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import type { Prisma as AdminPrisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return withAdminAccess(req, async (access, db) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });

    const current = await db.corpus_collection_comments.findUnique({ where: { id }, select: { submission: { select: { activity_id: true } } } });
    if (!current?.submission.activity_id || !canActivityAction(access, current.submission.activity_id, "reject")) throw new AccessError(403, "没有该活动的评论审核权限");
    assertScope(access, "activity", current.submission.activity_id);
    const comment = await (async (tx: AdminPrisma.TransactionClient) => {
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
    })(db);

    return NextResponse.json({
      id: comment.id.toString(),
      status: comment.status,
    });
  });
}
