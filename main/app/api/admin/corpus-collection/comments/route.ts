import { activityWhere,withAdminAccess } from "@/lib/admin/access";
import { canActivityAction } from "@/lib/admin/policy";
import { parseBigIntId,parsePositiveInt } from "@/lib/services/corpus-collection";
import { Prisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

function serializeComment(comment: any) {
  return {
    id: comment.id.toString(),
    content: comment.content,
    status: comment.status,
    submission: comment.submission
      ? {
          id: comment.submission.id.toString(),
          title: comment.submission.title,
        }
      : null,
    author: comment.user
      ? {
          id: comment.user.id,
          name: comment.user.name,
          avatar: comment.user.wechatAvatar || comment.user.image,
        }
      : null,
    createdAt: comment.created_at?.toISOString?.(),
    updatedAt: comment.updated_at?.toISOString?.(),
  };
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
  const status = searchParams.get("status");
  const submissionId = parseBigIntId(searchParams.get("submissionId"));
  const q = searchParams.get("q");

  return withAdminAccess(req, async (access, db) => {
    const where: Prisma.corpus_collection_commentsWhereInput = {
      submission: { activity: activityWhere(access) },
      status: status || undefined,
      submission_id: submissionId ?? undefined,
      content: q ? { contains: q, mode: "insensitive" } : undefined,
    };

    const [items, total] = await Promise.all([
      db.corpus_collection_comments.findMany({
        where,
        include: {
          submission: { select: { id: true, title: true, activity_id: true } },
          user: { select: { id: true, name: true, image: true, wechatAvatar: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.corpus_collection_comments.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(item => ({ ...serializeComment(item), canApprove: !!item.submission?.activity_id && canActivityAction(access,item.submission.activity_id,"approve"), canReject: !!item.submission?.activity_id && canActivityAction(access,item.submission.activity_id,"reject") })),
      pagination: { page, pageSize, total },
    });
  });
}
