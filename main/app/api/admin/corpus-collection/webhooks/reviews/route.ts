import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function authWebhook(req: NextRequest) {
  const token = process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN;
  if (!token) return true;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}

function reviewStatusFromVerdict(verdict: unknown) {
  if (verdict === "pass") return "review_needed";
  if (verdict === "reject") return "review_needed";
  return "review_needed";
}

export async function POST(req: NextRequest) {
  if (!authWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const eventId = req.headers.get("x-event-id") || crypto.randomUUID();
  const payload = await req.json();

  const existing = await prisma.corpus_collection_review_events.findUnique({
    where: { event_id: eventId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ success: true, duplicate: true });

  const batch = payload.batchExternalId
    ? await prisma.corpus_collection_review_batches.findUnique({
        where: { batch_external_id: payload.batchExternalId },
      })
    : payload.batchId
      ? await prisma.corpus_collection_review_batches.findFirst({
          where: { agent_batch_id: payload.batchId },
        })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.corpus_collection_review_events.create({
      data: {
        event_id: eventId,
        batch_id: batch?.id,
        submission_id: payload.submissionExternalId
          ? BigInt(payload.submissionExternalId)
          : null,
        event: payload.event,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    if (payload.event === "submission.reviewed" && batch) {
      const submissionId = BigInt(payload.submissionExternalId);
      await tx.corpus_collection_review_batch_items.updateMany({
        where: {
          batch_id: batch.id,
          submission_external_id: payload.submissionExternalId,
        },
        data: {
          status: payload.result?.status || "completed",
          result: payload.result as Prisma.InputJsonValue,
        },
      });
      await tx.corpus_collection_submissions.update({
        where: { id: submissionId },
        data: {
          review_status: reviewStatusFromVerdict(payload.result?.verdict),
          ai_review_result: payload.result as Prisma.InputJsonValue,
          review_reason: payload.result?.verdictReason || null,
        },
      });
    }

    if (payload.event === "batch.finished" && batch) {
      await tx.corpus_collection_review_batches.update({
        where: { id: batch.id },
        data: {
          status: payload.status,
          failure_reason: payload.failureReason || null,
          progress: (payload.summary ?? {}) as Prisma.InputJsonValue,
          finished_at: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ success: true });
}
