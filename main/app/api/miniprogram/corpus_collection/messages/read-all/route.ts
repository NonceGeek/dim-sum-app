import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const result = await prisma.corpus_collection_messages.updateMany({
      where: { user_id: user.userId, is_read: false },
      data: { is_read: true },
    });

    return NextResponse.json({
      updatedCount: result.count,
      unreadNotificationCount: 0,
    });
  });
}

