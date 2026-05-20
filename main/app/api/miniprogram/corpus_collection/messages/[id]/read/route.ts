import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId } from "@/lib/services/corpus-collection";

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid message id" }, { status: 400 });

    const message = await prisma.corpus_collection_messages.findFirst({
      where: { id, user_id: user.userId },
      select: { id: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await prisma.corpus_collection_messages.update({
      where: { id },
      data: { is_read: true },
    });

    const unreadNotificationCount = await prisma.corpus_collection_messages.count({
      where: { user_id: user.userId, is_read: false },
    });

    return NextResponse.json({
      id: id.toString(),
      isRead: true,
      unreadNotificationCount,
    });
  });
}

