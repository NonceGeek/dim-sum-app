import { NextRequest, NextResponse } from "next/server";
import { withSubmissionAccess, batchScope, AccessError } from "@/lib/services/submission-access";
import { z } from "zod";
import { submissionIdsSchema } from "@/lib/services/submission-mutations";
import { startSubmissionBatches } from "@/lib/services/submission-ai";
import { prisma } from "@/lib/prisma";
import {
  parsePositiveInt,
} from "@/lib/services/corpus-collection";

export const maxDuration = 300;

function serializeBatch(batch: any) {
  return {
    id: batch.id.toString(),
    batchExternalId: batch.batch_external_id,
    agentBatchId: batch.agent_batch_id,
    status: batch.status,
    context: batch.context,
    submissionCount: batch.submission_count,
    progress: batch.progress,
    failureReason: batch.failure_reason,
    createdAt: batch.created_at?.toISOString?.(),
    updatedAt: batch.updated_at?.toISOString?.(),
  };
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
  const status = searchParams.get("status");

  return withSubmissionAccess(req, async (access) => {
    const where = { ...batchScope(access), status: status || undefined };
    const [items, total] = await prisma.$transaction([
      prisma.corpus_collection_review_batches.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_review_batches.count({ where }),
    ]);
    return NextResponse.json({
      items: items.map(serializeBatch),
      pagination: { page, pageSize, total },
    });
  });
}

export async function POST(req: NextRequest) {
  return withSubmissionAccess(req, async (access) => {
    const parsed = z.object({ submissionIds: submissionIdsSchema, context: z.record(z.unknown()).optional() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AccessError(400, "AI 批次参数无效");
    const batches = await startSubmissionBatches(access.userId, parsed.data.submissionIds.map(BigInt), parsed.data.context ?? {}, req.url);
    return NextResponse.json({ batches }, { status: 201 });
  });
}
