import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  BUSINESS_ROLES,
  SCOPE_ROLES,
  SCOPE_TYPES,
  canScope,
  scopeIds,
  type AdminAccess,
  type ScopeAction,
  type ScopeType,
} from "./policy";
import { AccessError, jsonSnapshot, lockUsers } from "./security";
export { AccessError } from "./security";
export async function loadAdminAccess(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<AdminAccess> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      isSystemAdmin: true,
      isSuperAdmin: true,
      adminBusinessRoles: { where: { active: true } },
      adminScopeGrants: { where: { revoked_at: null } },
    },
  });
  if (!user || user.status !== "ACTIVE")
    throw new AccessError(403, "账号不可用");
  return {
    userId,
    isPlatformAdmin: user.isSuperAdmin || user.isSystemAdmin,
    isSuperAdmin: user.isSuperAdmin,
    businessRoles: user.adminBusinessRoles
      .filter((r) => r.active)
      .map((r) => r.role)
      .filter((r): r is AdminAccess["businessRoles"][number] =>
        BUSINESS_ROLES.includes(r as never),
      ),
    grants: user.adminScopeGrants
      .filter(
        (g) =>
          g.revoked_at === null &&
          SCOPE_TYPES.includes(g.scope_type as never) &&
          SCOPE_ROLES.includes(g.role as never) &&
          /^[1-9]\d*$/.test(g.scope_id),
      )
      .map((g) => ({
        scopeType: g.scope_type as ScopeType,
        scopeId: g.scope_id,
        role: g.role as "ADMIN" | "OPERATOR",
        actions: g.actions,
      })),
  };
}
export function hasAdminAccess(access: AdminAccess) {
  return (
    access.isPlatformAdmin ||
    access.businessRoles.length > 0 ||
    SCOPE_TYPES.some((t) => scopeIds(access, t)!.length > 0)
  );
}
/** All browser business requests read live grants. Writes serialize with revocation on the actor row. */
export async function withAdminAccess(
  req: NextRequest,
  handler: (
    access: AdminAccess,
    db: Prisma.TransactionClient,
  ) => Promise<NextResponse>,
) {
  const session = await getAuthSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const run = async (db: Prisma.TransactionClient) => {
    const access = await loadAdminAccess(session.user.id!, db);
    if (!hasAdminAccess(access)) throw new AccessError(403, "没有后台业务权限");
    const response = await handler(access, db);
    if (req.method !== "GET")
      await db.corpus_collection_audit_logs.create({
        data: {
          operator_id: access.userId,
          operator_role: access.isPlatformAdmin
            ? "PLATFORM_ADMIN"
            : "SCOPED_ADMIN",
          action: "admin.business.request",
          outcome: response.ok ? "success" : "denied",
          scope_type:
            access.touchedScopes?.length === 1
              ? access.touchedScopes[0].type
              : null,
          scope_id:
            access.touchedScopes?.length === 1
              ? access.touchedScopes[0].id
              : null,
          result_summary: jsonSnapshot({
            path: req.nextUrl.pathname,
            method: req.method,
            status: response.status,
            scopes: access.touchedScopes ?? [],
          }),
        },
      });
    return response;
  };
  try {
    const response =
      req.method === "GET"
        ? await run(prisma)
        : await prisma.$transaction(
            async (tx) => {
              await lockUsers(tx, [session.user.id!]);
              return run(tx);
            },
            { timeout: 60000 },
          );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "对象标识已存在，请刷新后重试" }, { status: 409 });
    if (!(error instanceof AccessError))
      console.error("Scoped admin request failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof AccessError ? error.message : "操作失败，请重试",
      },
      {
        status: error instanceof AccessError ? error.status : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
export function assertScope(
  access: AdminAccess,
  type: ScopeType,
  id: string | bigint | number,
  action: ScopeAction = "view",
) {
  if (!canScope(access, type, id, action))
    throw new AccessError(403, "没有该对象的操作权限");
  const scopes = (access.touchedScopes ??= []);
  if (!scopes.some((s) => s.type === type && s.id === String(id)))
    scopes.push({ type, id: String(id) });
}
export async function assertDataset(
  access: AdminAccess,
  name: string,
  action: ScopeAction = "view",
  db: Prisma.TransactionClient = prisma,
) {
  const dataset = await db.cantonese_categories.findUnique({
    where: { name },
    select: { id: true, name: true },
  });
  if (!dataset) throw new AccessError(404, "语料集不存在");
  assertScope(access, "dataset", dataset.id, action);
  return dataset;
}
export function datasetWhere(
  access: AdminAccess,
  action: ScopeAction = "view",
): Prisma.cantonese_categoriesWhereInput {
  const ids = scopeIds(access, "dataset", action);
  return ids === null ? {} : { id: { in: ids } };
}
export function activityWhere(
  access: AdminAccess,
  action: ScopeAction = "view",
): Prisma.corpus_collection_activitiesWhereInput {
  const ids = scopeIds(access, "activity", action);
  return ids === null ? {} : { id: { in: ids } };
}
export function corpusWhere(
  access: AdminAccess,
  action: ScopeAction = "view",
): Prisma.cantonese_corpus_allWhereInput {
  return access.isPlatformAdmin
    ? {}
    : { cantonese_categories: datasetWhere(access, action) };
}
export async function grantCreatedObject(
  db: Prisma.TransactionClient,
  userId: string,
  type: ScopeType,
  id: string | bigint,
) {
  const grant = await db.admin_scope_grants.create({
    data: {
      user_id: userId,
      scope_type: type,
      scope_id: String(id),
      role: "ADMIN",
      granted_by: userId,
      note: "创建者自动获得对象管理权",
    },
  });
  await db.corpus_collection_audit_logs.create({
    data: {
      operator_id: userId,
      action: "admin.object.created",
      scope_type: type,
      scope_id: String(id),
      after_state: jsonSnapshot(grant),
    },
  });
  return grant;
}
/** Internal SQL identifiers only; never pass request data as column. */
export function activitySql(access: AdminAccess, column = '"activity_id"') {
  const ids = scopeIds(access, "activity");
  return ids === null
    ? Prisma.sql`TRUE`
    : ids.length
      ? Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(ids)})`
      : Prisma.sql`FALSE`;
}
