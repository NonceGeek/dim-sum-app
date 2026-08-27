import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSubmissionReviewBatch } from "@/lib/services/agent";
import {
  getCallbackBaseUrl,
  parseBigIntId,
  parsePositiveInt,
} from "@/lib/services/corpus-collection";

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

  return requireAdmin(req, async () => {
    const where = { status: status || undefined };
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
  return requireAdmin(req, async (_req, userId) => {
    const body = await req.json();
    const ids = Array.isArray(body.submissionIds)
      ? body.submissionIds.map(parseBigIntId).filter(Boolean)
      : [];

    if (ids.length < 1 || ids.length > 100) {
      return NextResponse.json(
        { error: "submissionIds must contain 1 to 100 items" },
        { status: 400 }
      );
    }

    const submissions = await prisma.corpus_collection_submissions.findMany({
      where: {
        id: { in: ids as bigint[] },
        review_status: { in: ["pending_review", "review_needed"] },
      },
      include: { media: { orderBy: { sort_order: "asc" } }, activity: true },
    });

    if (submissions.length !== ids.length) {
      return NextResponse.json(
        { error: "Some submissions are not reviewable" },
        { status: 400 }
      );
    }

    const batchExternalId = body.batchExternalId || `cc-${Date.now()}`;
    const callbackUrl = `${getCallbackBaseUrl(req.url)}/api/admin/corpus-collection/webhooks/reviews`;
    const context = body.context ?? {};
    const agentPayload = {
      batchExternalId,
      callbackUrl,
      context,
      submissions: submissions.map((submission) => {
        const media = submission.media;
        return {
          submissionExternalId: submission.id.toString(),
          title: submission.title,
          intro: submission.intro,
          images: media.filter((item) => item.media_type === "image").map((item) => item.url),
          audio: media.find((item) => item.media_type === "audio")?.url,
          video: media.find((item) => item.media_type === "video")?.url,
        };
      }),
    };

    const agentResult = await createSubmissionReviewBatch(agentPayload);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.corpus_collection_review_batches.create({
        data: {
          batch_external_id: batchExternalId,
          agent_batch_id: agentResult.batchId,
          activity_id: parseBigIntId(body.activityId),
          status: agentResult.status,
          context: context as Prisma.InputJsonValue,
          submission_count: agentResult.submissionCount,
          progress: {} as Prisma.InputJsonValue,
          created_by: userId,
          items: {
            create: submissions.map((submission, index) => ({
              submission_id: submission.id,
              submission_external_id: submission.id.toString(),
              ordinal: index,
              status: "queued",
            })),
          },
        },
      });
      await tx.corpus_collection_submissions.updateMany({
        where: { id: { in: ids as bigint[] } },
        data: { review_status: "ai_reviewing" },
      });
      return created;
    });

    return NextResponse.json(serializeBatch(batch), { status: 201 });
  });
}
