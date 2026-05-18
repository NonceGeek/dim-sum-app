import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, parsePositiveInt } from "@/lib/services/corpus-collection";

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

  return requireAdmin(req, async () => {
    const where: Prisma.corpus_collection_commentsWhereInput = {
      status: status || undefined,
      submission_id: submissionId ?? undefined,
      content: q ? { contains: q, mode: "insensitive" } : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.corpus_collection_comments.findMany({
        where,
        include: {
          submission: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, image: true, wechatAvatar: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_comments.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(serializeComment),
      pagination: { page, pageSize, total },
    });
  });
}
