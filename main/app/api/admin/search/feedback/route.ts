import { processFeedback } from "@/lib/search-miniprogram/admin";
import { NextRequest, NextResponse } from "next/server";
import { withSearchAdmin as requireAdmin } from "@/lib/search-miniprogram/admin";
import { prisma } from "@/lib/prisma";
import {
  feedbackStatuses,
  feedbackTypes,
  feedbackUpdate,
  SearchError,
} from "@/lib/search-miniprogram/contracts";
import { failure, headers, readJson } from "@/lib/search-miniprogram/http";
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const p = req.nextUrl.searchParams;
      const status = p.get("status");
      const type = p.get("type");
      const page = Number(p.get("page") ?? 1);
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 10000 ||
        (status && !feedbackStatuses.includes(status as never)) ||
        (type && !feedbackTypes.includes(type as never))
      )
        throw new SearchError(400, "INVALID_FILTER", "筛选参数有误");
      const where = {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      };
      const [items, total] = await prisma.$transaction([
        prisma.search_feedback.findMany({
          where,
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          skip: (page - 1) * 20,
          take: 20,
        }),
        prisma.search_feedback.count({ where }),
      ]);
      return NextResponse.json(
        {
          items: items.map((r) => ({
            id: r.id,
            type: r.type,
            description: r.description,
            entryId: r.entry_id,
            userId: r.user_id,
            status: r.status,
            note: r.staff_note,
            handledBy: r.handled_by,
            handledAt: r.handled_at?.toISOString() ?? null,
            createdAt: r.created_at.toISOString(),
            updatedAt: r.updated_at.toISOString(),
          })),
          total,
          page,
          pageSize: 20,
        },
        { headers },
      );
    } catch (error) {
      return failure(error);
    }
  });
}
export async function PATCH(req: NextRequest) {
  return requireAdmin(req, async (_req, userId) => {
    try {
      const data = feedbackUpdate.safeParse(await readJson(req));
      if (!data.success)
        throw new SearchError(400, "INVALID_UPDATE", "处理内容无效");
      const v = data.data;
      const result = await prisma.$transaction(
        (tx) => processFeedback(tx, userId, v),
        { maxWait: 10000, timeout: 12000 },
      );
      return NextResponse.json(result, { headers });
    } catch (error) {
      return failure(error);
    }
  });
}
