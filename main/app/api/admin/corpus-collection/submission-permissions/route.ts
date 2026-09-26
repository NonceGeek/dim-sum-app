import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  COLLECTION_ACTIONS,
  COLLECTION_ROLES,
} from "@/lib/collection-permissions";
import {
  requireCollectionAdmin,
  AccessError,
  audit,
  loadSubmissionAccess,
  lockUsers,
} from "@/lib/services/submission-access";
const schema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(COLLECTION_ROLES),
    active: z.boolean(),
    note: z.string().trim().max(1000),
    grants: z
      .array(
        z
          .object({
            activityId: z.string().regex(/^[1-9]\d*$/),
            actions: z
              .array(z.enum(COLLECTION_ACTIONS))
              .refine(
                (v) => !v.length || v.includes("view"),
                "其他权限需要查看权限",
              ),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export async function GET(req: NextRequest) {
  return requireCollectionAdmin(req, async () => {
    const userId = new URL(req.url).searchParams.get("userId");
    const activities = await prisma.corpus_collection_activities.findMany({
      select: { id: true, title: true, display_uuid: true },
      orderBy: { created_at: "desc" },
    });
    if (!userId)
      return NextResponse.json({
        activities: activities.map((a) => ({
          id: String(a.id),
          title: a.title,
          displayUuid: a.display_uuid,
        })),
      });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        status: true,
        isSystemAdmin: true,
        isSuperAdmin: true,
        collectionOperatorRole: true,
      },
    });
    if (!user) throw new AccessError(404, "用户不存在");
    const grants = await prisma.corpus_collection_activity_permissions.findMany(
      { where: { user_id: userId } },
    );
    return NextResponse.json({
      user,
      grants: grants.map((p) => ({
        activityId: String(p.activity_id),
        actions: p.submission_actions,
      })),
      activities: activities.map((a) => ({
        id: String(a.id),
        title: a.title,
        displayUuid: a.display_uuid,
      })),
    });
  });
}
export async function PUT(req: NextRequest) {
  return requireCollectionAdmin(req, async (_req, operatorId) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new AccessError(400, "配置无效，操作权限必须包含查看权限");
    const input = parsed.data;
    if (
      new Set(input.grants.map((g) => g.activityId)).size !==
      input.grants.length
    )
      throw new AccessError(400, "活动不可重复");
    await prisma.$transaction(
      async (tx) => {
        await lockUsers(tx, [operatorId, input.userId]);
        const access = await loadSubmissionAccess(operatorId, tx);
        if (!access.isAdmin)
          throw new AccessError(403, "仅系统管理员可配置权限");
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        if (!user || user.status !== "ACTIVE")
          throw new AccessError(404, "用户不存在或不可用");
        if (user.isSystemAdmin || user.isSuperAdmin)
          throw new AccessError(
            400,
            "系统管理员已有全部投稿权限，无需活动授权",
          );
        const ids = input.grants.map((g) => BigInt(g.activityId));
        if (
          (await tx.corpus_collection_activities.count({
            where: { id: { in: ids } },
          })) !== ids.length
        )
          throw new AccessError(400, "活动不存在");
        const previousRole =
          await tx.corpus_collection_operator_roles.findUnique({
            where: { user_id: input.userId },
          });
        const previous =
          await tx.corpus_collection_activity_permissions.findMany({
            where: { user_id: input.userId },
          });
        const role = await tx.corpus_collection_operator_roles.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
            role_code: input.role,
            active: input.active,
            assigned_by: operatorId,
            note: input.note,
          },
          update: {
            role_code: input.role,
            active: input.active,
            assigned_by: operatorId,
            note: input.note,
          },
        });
        await audit(tx, access, "submission.role.configured", {
          before: previousRole,
          after: role,
          note: input.note,
          summary: { granteeUserId: input.userId, authorizedBy: operatorId },
        });
        // Only submission fields change. Questionnaire grants are preserved.
        const desired = new Map(
          input.grants.map((g) => [g.activityId, g.actions]),
        );
        for (const id of new Set([
          ...previous.map((g) => String(g.activity_id)),
          ...desired.keys(),
        ])) {
          const actions = desired.get(id) ?? [];
          const before =
            previous.find((g) => String(g.activity_id) === id)
              ?.submission_actions ?? [];
          if (JSON.stringify(before) === JSON.stringify(actions)) continue;
          await tx.corpus_collection_activity_permissions.upsert({
            where: {
              user_id_activity_id: {
                user_id: input.userId,
                activity_id: BigInt(id),
              },
            },
            create: {
              user_id: input.userId,
              activity_id: BigInt(id),
              can_view_insights: false,
              submission_actions: actions,
              submission_note: input.note,
              assigned_by: operatorId,
            },
            update: {
              submission_actions: actions,
              submission_note: input.note,
            },
          });
          await audit(
            tx,
            access,
            actions.length
              ? "submission.permission.configured"
              : "submission.permission.revoked",
            {
              activityId: BigInt(id),
              before,
              after: actions,
              note: input.note,
              summary: {
                granteeUserId: input.userId,
                authorizedBy: operatorId,
              },
            },
          );
        }
      },
      { timeout: 15000 },
    );
    return NextResponse.json({ success: true });
  });
}
