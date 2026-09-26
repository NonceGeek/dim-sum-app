import { prisma } from "@/lib/prisma";
import { canAct, CollectionAccess } from "@/lib/collection-permissions";
import {
  AccessError,
  audit,
  loadSubmissionAccess,
  lockUsers,
} from "./submission-access";
import { createSubmissionReviewBatch } from "./agent";
import { getCallbackBaseUrl } from "./corpus-collection";

export async function startSubmissionBatches(
  userId: string,
  ids: bigint[],
  context: Record<string, any>,
  requestUrl: string,
  dependencies = { db: prisma, send: createSubmissionReviewBatch },
) {
  const { db, send } = dependencies;
  if (!process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN)
    throw new AccessError(503, "AI 审核回调凭据尚未配置");
  let actor: CollectionAccess;
  const batches = await db.$transaction(
    async (tx) => {
      await lockUsers(tx, [userId]);
      actor = await loadSubmissionAccess(userId, tx);
      for (const id of [...ids].sort((a, b) => (a < b ? -1 : 1)))
        await tx.$queryRaw`SELECT id FROM corpus_collection_submissions WHERE id = ${id} FOR UPDATE`;
      const rows = await tx.corpus_collection_submissions.findMany({
        where: { id: { in: ids } },
        include: { media: { orderBy: { sort_order: "asc" } } },
      });
      if (
        rows.length !== ids.length ||
        rows.some((s) => !canAct(actor, s.activity_id, "view"))
      )
        throw new AccessError(404, "投稿不存在或不可访问");
      if (rows.some((s) => !canAct(actor, s.activity_id, "ai_review")))
        throw new AccessError(403, "没有 AI 审核权限");
      if (rows.some((s) => s.channel_video != null))
        throw new AccessError(422, "视频号作品需要人工审核，请从 AI 审核批次中移除");
      if (
        rows.some(
          (s) => !["pending_review", "review_needed"].includes(s.review_status),
        )
      )
        throw new AccessError(409, "部分投稿当前不可发起 AI 审核，请刷新列表");
      const groups = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = String(row.activity_id);
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      const created = [];
      for (const submissions of groups.values()) {
        const batch = await tx.corpus_collection_review_batches.create({
          data: {
            batch_external_id: `cc-${crypto.randomUUID()}`,
            activity_id: submissions[0].activity_id,
            status: "dispatching",
            context,
            submission_count: submissions.length,
            created_by: userId,
            items: {
              create: submissions.map((s, i) => ({
                submission_id: s.id,
                submission_external_id: String(s.id),
                ordinal: i,
              })),
            },
          },
        });
        await tx.corpus_collection_submissions.updateMany({
          where: { id: { in: submissions.map((s) => s.id) } },
          data: { review_status: "ai_reviewing" },
        });
        for (const s of submissions)
          await audit(tx, actor, "submission.ai_review", {
            activityId: s.activity_id,
            submissionId: s.id,
            before: { reviewStatus: s.review_status },
            after: { reviewStatus: "ai_reviewing" },
            summary: {
              batchId: String(batch.id),
              batchExternalId: batch.batch_external_id,
            },
          });
        created.push({ batch, submissions });
      }
      return created;
    },
    { timeout: 15000 },
  );
  // All authorization has passed and durable tasks exist before any external side effect.
  // Accepted jobs continue as system work even if the initiating user is subsequently revoked.
  const dispatch = async ({ batch, submissions }: (typeof batches)[number]) => {
    try {
      const result = await send(
        {
          batchExternalId: batch.batch_external_id,
          callbackUrl: `${getCallbackBaseUrl(requestUrl)}/api/admin/corpus-collection/webhooks/reviews`,
          context,
          submissions: submissions.map((s) => ({
            submissionExternalId: String(s.id),
            title: s.title,
            intro: s.intro,
            images: s.media
              .filter((m) => m.media_type === "image")
              .map((m) => m.url),
            audio: s.media.find((m) => m.media_type === "audio")?.url,
            video: s.media.find((m) => m.media_type === "video")?.url,
          })),
        },
        AbortSignal.timeout(20000),
      );
      // A fast callback may already have completed this batch. Do not regress its status.
      await db.corpus_collection_review_batches.updateMany({
        where: { id: batch.id, status: "dispatching" },
        data: { agent_batch_id: result.batchId, status: result.status },
      });
      return {
        id: String(batch.id),
        activityId: batch.activity_id?.toString() ?? null,
        status: "submitted",
        count: submissions.length,
      };
    } catch {
      // Timeouts may mean the external task was accepted. Keep its members reserved;
      // an operator can mark them for re-review before explicitly retrying.
      await db.$transaction(async (tx) => {
        await tx.corpus_collection_review_batches.updateMany({
          where: { id: batch.id, status: "dispatching" },
          data: {
            status: "dispatch_unknown",
            failure_reason: "发送失败或响应超时，请核对批次结果后重试",
          },
        });
        await audit(tx, actor!, "submission.ai_dispatch", {
          activityId: batch.activity_id,
          outcome: "unknown",
          summary: { batchId: String(batch.id) },
        });
      });
      return {
        id: String(batch.id),
        activityId: batch.activity_id?.toString() ?? null,
        status: "dispatch_unknown",
        count: submissions.length,
      };
    }
  };
  const results: Awaited<ReturnType<typeof dispatch>>[] = new Array(
    batches.length,
  );
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(10, batches.length) }, async () => {
      while (cursor < batches.length) {
        const index = cursor++;
        results[index] = await dispatch(batches[index]);
      }
    }),
  );
  return results;
}
