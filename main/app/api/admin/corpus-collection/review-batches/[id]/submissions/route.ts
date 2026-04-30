import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, parsePositiveInt } from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
  const status = searchParams.get("status");

  return requireAdmin(req, async () => {
    const batchId = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!batchId) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    const where = { batch_id: batchId, status: status || undefined };
    const [items, total] = await Promise.all([
      prisma.corpus_collection_review_batch_items.findMany({
        where,
        include: { submission: { select: { id: true, title: true, review_status: true } } },
        orderBy: { ordinal: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_review_batch_items.count({ where }),
    ]);
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id.toString(),
        submissionId: item.submission_id.toString(),
        submissionExternalId: item.submission_external_id,
        status: item.status,
        result: item.result,
        submission: {
          id: item.submission.id.toString(),
          title: item.submission.title,
          reviewStatus: item.submission.review_status,
        },
      })),
      pagination: { page, pageSize, total },
    });
  });
}
