import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, parsePositiveInt } from "@/lib/services/corpus-collection";

function serializeComment(comment: any) {
  return {
    id: comment.id.toString(),
    content: comment.content,
    status: comment.status,
    author: {
      id: comment.user.id,
      name: comment.user.name,
      avatar: comment.user.wechatAvatar || comment.user.image,
    },
    createdAt: comment.created_at.toISOString(),
  };
}

export async function GET(req: NextRequest, context: AppRouteContext) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);

  return requireMiniprogramAuth(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid work id" }, { status: 400 });

    const where = { submission_id: id, status: "approved" };
    const [items, total] = await Promise.all([
      prisma.corpus_collection_comments.findMany({
        where,
        include: { user: { select: { id: true, name: true, image: true, wechatAvatar: true } } },
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

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid work id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json({ error: "Missing required field: content" }, { status: 400 });
    }

    const comment = await prisma.corpus_collection_comments.create({
      data: {
        submission_id: id,
        user_id: user.userId,
        content: body.content,
        status: "pending_review",
      },
    });

    return NextResponse.json(
      {
        id: comment.id.toString(),
        status: comment.status,
        message: "评论已提交，等待审核",
      },
      { status: 201 }
    );
  });
}
