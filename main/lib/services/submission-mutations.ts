import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CollectionAction, canAct } from "@/lib/collection-permissions";
import {
  AccessError,
  audit,
  loadSubmissionAccess,
  lockUsers,
} from "./submission-access";
import { submissionInclude } from "./corpus-collection";

export const submissionIdsSchema = z
  .array(z.string().regex(/^[1-9]\d*$/))
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "投稿 ID 不可重复");
export const mutationSchemas = {
  approve: z.object({}).strict(),
  reject: z.object({ reason: z.string().trim().min(1).max(2000) }).strict(),
  review_needed: z
    .object({ reason: z.string().trim().max(2000).optional() })
    .strict(),
  display: z
    .object({
      isFeatured: z.boolean().optional(),
      showOnHome: z.boolean().optional(),
      visibility: z.enum(["public", "private"]).optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0),
  award: z
    .object({
      isAwarded: z.boolean(),
      awardStatus: z.enum(["none", "awarded"]).optional(),
      awardInfo: z.record(z.unknown()).optional(),
    })
    .strict(),
};
export type MutationKind = keyof typeof mutationSchemas;
export function mutationActions(
  kind: MutationKind,
  body: Record<string, unknown>,
): CollectionAction[] {
  if (kind !== "display") return [kind];
  return [
    body.isFeatured !== undefined && "feature",
    body.showOnHome !== undefined && "home",
    body.visibility !== undefined && "visibility",
  ].filter(Boolean) as CollectionAction[];
}
export async function mutateSubmissions(
  userId: string,
  ids: bigint[],
  kind: MutationKind,
  input: unknown,
  db = prisma,
) {
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
    throw new AccessError(400, "Invalid submission IDs");
  const parsed = mutationSchemas[kind].safeParse(input);
  if (!parsed.success) throw new AccessError(400, "操作参数无效");
  const body = parsed.data as Record<string, any>;
  const actions = mutationActions(kind, body);
  return db.$transaction(
    async (tx) => {
      await lockUsers(tx, [userId]);
      const access = await loadSubmissionAccess(userId, tx);
      for (const id of [...ids].sort((a, b) => (a < b ? -1 : 1))) {
        await tx.$queryRaw`SELECT id FROM corpus_collection_submissions WHERE id = ${id} FOR UPDATE`;
      }
      const submissions = await tx.corpus_collection_submissions.findMany({
        where: { id: { in: ids } },
      });
      if (
        submissions.length !== ids.length ||
        submissions.some((s) => !canAct(access, s.activity_id, "view"))
      )
        throw new AccessError(404, "投稿不存在或不可访问");
      if (
        submissions.some((s) =>
          actions.some((action) => !canAct(access, s.activity_id, action)),
        )
      )
        throw new AccessError(403, "没有执行此操作的权限");
      const results = [];
      for (const previous of submissions) {
        const data: Prisma.corpus_collection_submissionsUpdateInput = {};
        if (["approve", "reject", "review_needed"].includes(kind)) {
          data.review_status =
            kind === "approve"
              ? "approved"
              : kind === "reject"
                ? "rejected"
                : "review_needed";
          data.reviewed_at = new Date();
          data.reviewer = { connect: { id: userId } };
          data.review_reason = body.reason || null;
          if (kind === "approve") data.visibility = "public";
          if (kind === "reject") data.visibility = "private";
        } else if (kind === "display") {
          data.is_featured = body.isFeatured;
          data.show_on_home = body.showOnHome;
          data.visibility = body.visibility;
        } else {
          data.is_awarded = body.isAwarded;
          data.award_status = body.isAwarded ? "awarded" : "none";
          if (body.awardInfo !== undefined) data.award_info = body.awardInfo;
        }
        const updated = await tx.corpus_collection_submissions.update({
          where: { id: previous.id },
          data,
          include: submissionInclude,
        });
        if (
          kind === "approve" ||
          kind === "reject" ||
          (kind === "award" && body.isAwarded && !previous.is_awarded)
        ) {
          const title =
            kind === "approve"
              ? "审核通过"
              : kind === "reject"
                ? "审核未通过"
                : "中奖通知";
          await tx.corpus_collection_messages.create({
            data: {
              user_id: updated.user_id,
              submission_id: updated.id,
              title,
              content:
                kind === "reject"
                  ? `你的作品「${updated.title}」未通过审核：${body.reason}`
                  : `你的作品「${updated.title}」${kind === "approve" ? "已通过审核" : "已被标记为获奖作品"}。`,
              type: kind === "award" ? "中奖信息" : "审核信息",
            },
          });
        }
        await audit(tx, access, `submission.${kind}`, {
          activityId: previous.activity_id,
          submissionId: previous.id,
          before: auditState(previous),
          after: auditState(updated),
          summary: { actions, batchSize: ids.length },
        });
        results.push(updated);
      }
      return results;
    },
    { timeout: 15000 },
  );
}

function auditState(s: {
  review_status: string;
  visibility: string;
  is_featured: boolean;
  show_on_home: boolean;
  is_awarded: boolean;
  award_status: string;
  review_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}) {
  return {
    reviewStatus: s.review_status,
    visibility: s.visibility,
    isFeatured: s.is_featured,
    showOnHome: s.show_on_home,
    isAwarded: s.is_awarded,
    awardStatus: s.award_status,
    reviewReason: s.review_reason,
    reviewedBy: s.reviewed_by,
    reviewedAt: s.reviewed_at,
  };
}
