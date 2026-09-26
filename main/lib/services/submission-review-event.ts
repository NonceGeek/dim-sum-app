import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError, audit } from "./submission-access";
export const reviewEventSchema = z
  .object({
    event: z.enum(["submission.reviewed", "batch.finished"]),
    batchExternalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
    submissionExternalId: z
      .string()
      .regex(/^[1-9]\d*$/)
      .optional(),
    result: z.record(z.unknown()).optional(),
    status: z.string().optional(),
    failureReason: z.string().optional(),
    summary: z.record(z.unknown()).optional(),
  })
  .passthrough();
export async function processReviewEvent(
  payload: z.infer<typeof reviewEventSchema>,
  eventId: string,
  db = prisma,
) {
  await db.$transaction(async (tx) => {
    // Serialize duplicate deliveries (including events from separate batches).
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`;
    if (
      await tx.corpus_collection_review_events.findUnique({
        where: { event_id: eventId },
      })
    )
      return;
    const batch = await tx.corpus_collection_review_batches.findFirst({
      where: payload.batchExternalId
        ? { batch_external_id: payload.batchExternalId }
        : { agent_batch_id: payload.batchId },
    });
    if (!batch) throw new AccessError(404, "Batch not found");
    const actor = {
      userId: "system:ai-review",
      role: "SYSTEM_SERVICE",
      isAdmin: true,
      grants: {},
    };
    if (payload.event === "submission.reviewed") {
      const submissionId = BigInt(payload.submissionExternalId!);
      const item = await tx.corpus_collection_review_batch_items.findUnique({
        where: {
          batch_id_submission_id: {
            batch_id: batch.id,
            submission_id: submissionId,
          },
        },
      });
      if (!item) throw new AccessError(404, "Submission is not a batch member");
      await tx.$queryRaw`SELECT id FROM corpus_collection_submissions WHERE id = ${submissionId} FOR UPDATE`;
      const submission =
        await tx.corpus_collection_submissions.findUniqueOrThrow({
          where: { id: submissionId },
        });
      const latest = await tx.corpus_collection_review_batch_items.findFirst({
        where: { submission_id: submissionId },
        orderBy: { id: "desc" },
      });
      const applicable =
        latest?.id === item.id &&
        submission.channel_video == null &&
        submission.review_status === "ai_reviewing" &&
        item.status !== "completed" &&
        item.status !== "superseded";
      await tx.corpus_collection_review_batch_items.update({
        where: { id: item.id },
        data: {
          status: applicable ? "completed" : "superseded",
          result: payload.result as any,
        },
      });
      if (applicable)
        await tx.corpus_collection_submissions.update({
          where: { id: submissionId },
          data: {
            review_status: "review_needed",
            ai_review_result: payload.result as any,
            review_reason:
              typeof payload.result?.verdictReason === "string"
                ? payload.result.verdictReason
                : null,
          },
        });
      await audit(tx, actor, "submission.ai_result", {
        activityId: submission.activity_id,
        submissionId,
        before: { reviewStatus: submission.review_status },
        after: {
          reviewStatus: applicable ? "review_needed" : submission.review_status,
        },
        outcome: applicable ? "success" : "ignored",
        summary: { batchId: String(batch.id), eventId },
      });
    } else {
      await tx.corpus_collection_review_batches.update({
        where: { id: batch.id },
        data: {
          status: payload.status || "completed",
          failure_reason: payload.failureReason || null,
          progress: (payload.summary as any) ?? {},
          finished_at: new Date(),
        },
      });
      await audit(tx, actor, "submission.ai_batch_finished", {
        activityId: batch.activity_id,
        summary: { batchId: String(batch.id), eventId },
      });
    }
    await tx.corpus_collection_review_events.create({
      data: {
        event_id: eventId,
        batch_id: batch.id,
        submission_id: payload.submissionExternalId
          ? BigInt(payload.submissionExternalId)
          : null,
        event: payload.event,
        payload: payload as any,
      },
    });
  });
}
