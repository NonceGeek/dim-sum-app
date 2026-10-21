import { prisma } from "@/lib/prisma";

const DEFAULT_DAILY_LIMIT = 30;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getDailyLimit(): number {
  const parsed = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

/** 当天（Asia/Shanghai）零点对应的 UTC 时间 */
export function startOfShanghaiDay(now = new Date()): Date {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - SHANGHAI_OFFSET_MS);
}

export async function getQuota(userId: string, now = new Date()) {
  const limit = getDailyLimit();
  const used = await prisma.assistant_messages.count({
    where: {
      user_id: userId,
      role: { in: ["user", "action"] },
      created_at: { gte: startOfShanghaiDay(now) },
    },
  });
  return { limit, used, remaining: Math.max(0, limit - used) };
}
