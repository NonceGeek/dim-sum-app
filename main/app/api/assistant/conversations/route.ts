import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 50;

export async function GET(req: NextRequest) {
  return requireAuth(req, async (_req, userId) => {
    const conversations = await prisma.assistant_conversations.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { updated_at: "desc" },
      take: LIST_LIMIT,
      select: { id: true, title: true, created_at: true, updated_at: true },
    });
    return NextResponse.json(
      {
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.created_at.toISOString(),
          updatedAt: conversation.updated_at.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
