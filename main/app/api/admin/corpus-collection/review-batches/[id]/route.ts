import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId } from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
    const batch = await prisma.corpus_collection_review_batches.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    return NextResponse.json({
      id: batch.id.toString(),
      batchExternalId: batch.batch_external_id,
      agentBatchId: batch.agent_batch_id,
      status: batch.status,
      context: batch.context,
      progress: batch.progress,
      submissionCount: batch.submission_count,
      items: batch.items.map((item) => ({
        id: item.id.toString(),
        submissionId: item.submission_id.toString(),
        submissionExternalId: item.submission_external_id,
        status: item.status,
        result: item.result,
      })),
    });
  });
}
