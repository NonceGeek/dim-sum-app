import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedConversation, toUIMessages } from "@/lib/assistant/conversation";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_LIMIT = 100;

async function resolveId(context: AppRouteContext) {
  const id = await getStringRouteParam(context, "id");
  return id && UUID_PATTERN.test(id) ? id : null;
}

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireAuth(req, async (_req, userId) => {
    const id = await resolveId(context);
    const conversation = id ? await findOwnedConversation(id, userId) : null;
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const rows = await prisma.assistant_messages.findMany({
      where: { conversation_id: conversation.id },
      orderBy: { created_at: "asc" },
      take: MESSAGE_LIMIT,
      select: { id: true, role: true, content: true, blocks: true, tool_trace: true, created_at: true },
    });
    return NextResponse.json(
      {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updated_at.toISOString(),
        },
        messages: await toUIMessages(rows),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}

export async function DELETE(req: NextRequest, context: AppRouteContext) {
  return requireAuth(req, async (_req, userId) => {
    const id = await resolveId(context);
    const conversation = id ? await findOwnedConversation(id, userId) : null;
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    await prisma.assistant_conversations.update({
      where: { id: conversation.id },
      data: { deleted_at: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
