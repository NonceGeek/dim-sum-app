import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { parsePositiveInt } from "@/lib/services/corpus-collection";

function serializeMessage(message: any) {
  return {
    id: message.id.toString(),
    date: message.created_at.toISOString().slice(0, 10),
    content: message.content,
    title: message.title,
    type: message.type,
    isRead: message.is_read,
    workId: message.submission_id?.toString?.(),
  };
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  return requireMiniprogramAuth(req, async (_req, user) => {
    const where = {
      user_id: user.userId,
      is_read: unreadOnly ? false : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.corpus_collection_messages.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_messages.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(serializeMessage),
      pagination: { page, pageSize, total },
    });
  });
}
