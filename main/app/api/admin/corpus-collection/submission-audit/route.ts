import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCollectionAdmin,
  jsonSnapshot,
} from "@/lib/services/submission-access";
import { parsePositiveInt } from "@/lib/services/corpus-collection";
import { userIdentityWhere } from "@/lib/services/collection-user-search";
export async function GET(req: NextRequest) {
  return requireCollectionAdmin(req, async () => {
    const params = new URL(req.url).searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const query = (params.get("q") ?? "").trim();
    if (query.length > 100)
      return NextResponse.json(
        { error: "Search is too long" },
        { status: 400 },
      );
    const matches = query
      ? await prisma.user.findMany({
          where: userIdentityWhere(query),
          select: { id: true },
        })
      : [];
    const where = {
      action: { startsWith: "submission." },
      operator_id: query
        ? { in: [...new Set([query, ...matches.map((u) => u.id)])] }
        : params.get("userId") || undefined,
    };
    const [items, total] = await prisma.$transaction([
      prisma.corpus_collection_audit_logs.findMany({
        where,
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        skip: (page - 1) * 30,
        take: 30,
      }),
      prisma.corpus_collection_audit_logs.count({ where }),
    ]);
    const operators = await prisma.user.findMany({
      where: {
        id: { in: [...new Set(items.map((item) => item.operator_id))] },
      },
      select: { id: true, name: true },
    });
    const names = new Map(operators.map((u) => [u.id, u.name]));
    return NextResponse.json(
      {
        items: jsonSnapshot(
          items.map((item) => ({
            ...item,
            operatorName: names.get(item.operator_id) ?? null,
          })),
        ),
        total,
        page,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
