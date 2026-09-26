import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCollectionAdmin,
  jsonSnapshot,
} from "@/lib/services/submission-access";
import { parsePositiveInt } from "@/lib/services/corpus-collection";
export async function GET(req: NextRequest) {
  return requireCollectionAdmin(req, async () => {
    const params = new URL(req.url).searchParams;
    const page = parsePositiveInt(params.get("page"), 1);
    const where = {
      action: { startsWith: "submission." },
      operator_id: params.get("userId") || undefined,
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
    return NextResponse.json({ items: jsonSnapshot(items), total, page });
  });
}
