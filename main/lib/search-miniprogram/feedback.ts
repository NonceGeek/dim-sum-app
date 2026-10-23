import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOptionalMiniprogramUser } from "@/lib/miniprogram-auth";
import type { NextRequest } from "next/server";
import { feedbackInput, sameFeedback, SearchError } from "./contracts";
import { getEntry } from "./service";
import type { z } from "zod";
export async function feedbackUser(req: NextRequest) {
  const token = await getOptionalMiniprogramUser(req);
  if (!token) {
    if (req.headers.has("authorization"))
      throw new SearchError(401, "INVALID_TOKEN", "登录已过期，请重新登录");
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE")
    throw new SearchError(401, "INVALID_TOKEN", "登录已过期，请重新登录");
  return user.id;
}
export async function submitFeedback(
  input: z.infer<typeof feedbackInput>,
  userId: string | null,
) {
  return prisma.$transaction((tx) => saveFeedback(tx, input, userId), {
    maxWait: 10000,
    timeout: 15000,
  });
}
export async function saveFeedback(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof feedbackInput>,
  userId: string | null,
) {
  // Serialize request-id retries and per-visitor/user rate limits across instances.
  for (const key of [
    ...new Set([
      `request:${input.requestId}`,
      `anon:${input.anonymousId}`,
      ...(userId ? [`user:${userId}`] : []),
    ]),
  ].sort())
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${key},0))`;
  const previous = await tx.search_feedback.findUnique({
    where: { request_id: input.requestId },
  });
  if (previous) {
    if (!sameFeedback(previous, input, userId))
      throw new SearchError(
        409,
        "REQUEST_CONFLICT",
        "请使用新的反馈标识提交修改后的内容",
      );
    return { feedback: previous, replayed: true };
  }
  const count = await tx.search_feedback.count({
    where: {
      created_at: { gte: new Date(Date.now() - 600000) },
      OR: [
        { anonymous_id: input.anonymousId },
        ...(userId ? [{ user_id: userId }] : []),
      ],
    },
  });
  if (count >= 5)
    throw new SearchError(429, "RATE_LIMITED", "提交较频繁，请稍后再试");
  if (input.entryId && !(await getEntry(input.entryId, tx)))
    throw new SearchError(
      404,
      "ENTRY_UNAVAILABLE",
      "关联内容暂不可用，请从通用反馈入口提交",
    );
  const feedback = await tx.search_feedback.create({
    data: {
      request_id: input.requestId,
      anonymous_id: input.anonymousId,
      user_id: userId,
      entry_id: input.entryId ?? null,
      type: input.type,
      description: input.description,
    },
  });
  return { feedback, replayed: false };
}
