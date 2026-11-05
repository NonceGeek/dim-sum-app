import { COLLECTION_ACTIONS } from "@/lib/collection-permissions";
import { PermissionAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { loadAdminAccess } from "./access";
import {
  BUSINESS_ROLES,
  SCOPE_ROLES,
  SCOPE_TYPES,
  businessRoleFor,
  canGrantScope,
} from "./policy";
import { AccessError, jsonSnapshot, lockUsers } from "./security";
const common = {
  userId: z.string().min(1).max(200),
  active: z.boolean(),
  note: z.string().trim().max(1000),
};
export const grantSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("business"),
      ...common,
      role: z.enum(BUSINESS_ROLES),
    })
    .strict(),
  z
    .object({
      kind: z.literal("scope"),
      ...common,
      scopeType: z.enum(SCOPE_TYPES),
      scopeId: z
        .string()
        .regex(/^[1-9]\d{0,18}$/)
        .refine((v) => BigInt(v) <= BigInt("9223372036854775807")),
      role: z.enum(SCOPE_ROLES),
      actions: z
        .array(z.enum(COLLECTION_ACTIONS))
        .max(COLLECTION_ACTIONS.length),
    })
    .strict(),
]);
export type GrantInput = z.infer<typeof grantSchema>;
export async function configureGrant(
  tx: Prisma.TransactionClient,
  actorId: string,
  input: GrantInput,
) {
  await lockUsers(tx, [actorId, input.userId]);
  const actor = await loadAdminAccess(actorId, tx);
  const target = await tx.user.findUnique({
    where: { id: input.userId },
    select: { status: true, isSystemAdmin: true, isSuperAdmin: true },
  });
  if (!target || target.status !== "ACTIVE")
    throw new AccessError(400, "目标账号不存在或不可用");
  if (target.isSystemAdmin || target.isSuperAdmin)
    throw new AccessError(400, "平台管理员无需业务授权；平台角色请由超管配置");
  if (!actor.isPlatformAdmin && actorId === input.userId)
    throw new AccessError(403, "不可修改自己的授权");
  let before: unknown;
  let after: unknown;
  if (input.kind === "business") {
    if (!actor.isPlatformAdmin)
      throw new AccessError(403, "业务角色仅由平台管理员授予");
    before = await tx.admin_business_roles.findUnique({
      where: { user_id_role: { user_id: input.userId, role: input.role } },
    });
    after = await tx.admin_business_roles.upsert({
      where: { user_id_role: { user_id: input.userId, role: input.role } },
      create: {
        user_id: input.userId,
        role: input.role,
        active: input.active,
        note: input.note,
        granted_by: actorId,
      },
      update: { active: input.active, note: input.note, granted_by: actorId },
    });
    if (!input.active) {
      const scopeType = input.role === "DATASET_ADMIN" ? "dataset" : "activity";
      const revoked = await tx.admin_scope_grants.findMany({
        where: {
          user_id: input.userId,
          scope_type: scopeType,
          role: "ADMIN",
          revoked_at: null,
        },
      });
      await tx.admin_scope_grants.updateMany({
        where: {
          user_id: input.userId,
          scope_type: scopeType,
          role: "ADMIN",
          revoked_at: null,
        },
        data: { revoked_at: new Date(), granted_by: actorId, note: input.note },
      });
      before = { role: before, revokedScopes: revoked };
    }
  } else {
    const key = {
      user_id: input.userId,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    };
    const previous = await tx.admin_scope_grants.findUnique({
      where: { user_id_scope_type_scope_id: key },
    });
    if (
      !canGrantScope(
        actor,
        input.scopeType,
        input.scopeId,
        input.role,
        previous?.revoked_at === null
          ? (previous.role as "ADMIN" | "OPERATOR")
          : undefined,
      )
    )
      throw new AccessError(
        403,
        "只能在所管对象授予运营，不可修改同级或上级管理员",
      );
    const exists =
      input.scopeType === "dataset"
        ? await tx.cantonese_categories.count({
            where: { id: BigInt(input.scopeId) },
          })
        : await tx.corpus_collection_activities.count({
            where: { id: BigInt(input.scopeId) },
          });
    if (!exists) throw new AccessError(400, "对象不存在");
    if (input.role === "ADMIN" && input.active) {
      const role = await tx.admin_business_roles.findUnique({
        where: {
          user_id_role: {
            user_id: input.userId,
            role: businessRoleFor(input.scopeType),
          },
        },
      });
      if (!role?.active)
        throw new AccessError(400, "请先授予对应的业务管理员角色");
    }
    if (
      (input.scopeType === "dataset" || input.role === "ADMIN") &&
      input.actions.length
    )
      throw new AccessError(400, "语料运营只做有/无，管理员不配置动作开关");
    if (
      input.scopeType === "activity" &&
      input.role === "OPERATOR" &&
      input.active &&
      !input.actions.includes("view")
    )
      throw new AccessError(400, "活动运营需包含查看权限");
    before = previous;
    const data = {
      role: input.role,
      actions: [...new Set(input.actions)],
      revoked_at: input.active ? null : new Date(),
      granted_by: actorId,
      note: input.note,
    };
    after = await tx.admin_scope_grants.upsert({
      where: { user_id_scope_type_scope_id: key },
      create: { ...key, ...data },
      update: data,
    });
  }
  await tx.permission_audit_logs.create({
    data: {
      operator_id: actorId,
      target_user_id: input.userId,
      action: input.active ? PermissionAction.GRANT : PermissionAction.REVOKE,
      old_value: jsonSnapshot(before ?? {}),
      new_value: jsonSnapshot({ input, result: after }),
    },
  });
  return after;
}
