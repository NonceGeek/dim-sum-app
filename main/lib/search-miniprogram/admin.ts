import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { feedbackUpdate, SearchError } from "./contracts";
import { failure } from "./http";
import type { z } from "zod";
export function isSearchPlatformAdmin(
  user: {
    status: string;
    isSystemAdmin: boolean;
    isSuperAdmin: boolean;
  } | null,
) {
  return user?.status === "ACTIVE" && (user.isSystemAdmin || user.isSuperAdmin);
}
export async function withSearchAdmin(
  req: NextRequest,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>,
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id)
      throw new SearchError(401, "AUTH_REQUIRED", "请先登录");
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, isSystemAdmin: true, isSuperAdmin: true },
    });
    if (!isSearchPlatformAdmin(user))
      throw new SearchError(403, "ADMIN_REQUIRED", "仅平台管理员可访问");
    return await handler(req, session.user.id);
  } catch (error) {
    return failure(error);
  }
}
export async function processFeedback(
  tx: Prisma.TransactionClient,
  userId: string,
  v: z.infer<typeof feedbackUpdate>,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { status: true, isSystemAdmin: true, isSuperAdmin: true },
  });
  if (!isSearchPlatformAdmin(user))
    throw new SearchError(403, "ADMIN_REQUIRED", "仅平台管理员可处理反馈");
  const result = await tx.search_feedback.updateMany({
    where: { id: v.id, updated_at: new Date(v.updatedAt) },
    data: {
      status: v.status,
      staff_note: v.note,
      handled_by: userId,
      handled_at: new Date(),
    },
  });
  if (!result.count)
    throw new SearchError(
      409,
      "FEEDBACK_CHANGED",
      "记录已更新，请刷新后再处理",
    );
  return { updated: true };
}
