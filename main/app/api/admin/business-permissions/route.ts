import {
  activityWhere,
  datasetWhere,
  withAdminAccess,
} from "@/lib/admin/access";
import { configureGrant, grantSchema } from "@/lib/admin/grants";
import { canScope, type ScopeType } from "@/lib/admin/policy";
import { AccessError, jsonSnapshot } from "@/lib/admin/security";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  collectionUserSearchWhere,
  userSearchSummary,
} from "@/lib/services/collection-user-search";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access) => {
    const params = req.nextUrl.searchParams;
    const canManage =
      access.isPlatformAdmin ||
      access.grants.some((g) =>
        canScope(access, g.scopeType, g.scopeId, "manage"),
      );
    if (!canManage) throw new AccessError(403, "无授权管理权限");
    if (params.has("q")) {
      const q = params.get("q")!.trim();
      if (q.length < 2 || q.length > 100)
        throw new AccessError(400, "请输入 2–100 个字符");
      const users = await prisma.user.findMany({
        where: collectionUserSearchWhere(q),
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isSystemAdmin: true,
          isSuperAdmin: true,
        },
        take: 21,
        orderBy: { id: "asc" },
      });
      return NextResponse.json({
        users: users.slice(0, 20).map(userSearchSummary),
        hasMore: users.length > 20,
      });
    }
    const datasets = await prisma.cantonese_categories.findMany({
      where: datasetWhere(access, "manage"),
      select: { id: true, name: true, nickname: true },
      orderBy: { id: "asc" },
    });
    const activities = await prisma.corpus_collection_activities.findMany({
      where: activityWhere(access, "manage"),
      select: { id: true, title: true },
      orderBy: { id: "asc" },
    });
    const userId = params.get("userId");
    const roles =
      userId && access.isPlatformAdmin
        ? await prisma.admin_business_roles.findMany({
            where: { user_id: userId },
          })
        : [];
    const grants = userId
      ? (
          await prisma.admin_scope_grants.findMany({
            where: { user_id: userId, revoked_at: null },
          })
        ).filter(
          (g) =>
            access.isPlatformAdmin ||
            canScope(access, g.scope_type as ScopeType, g.scope_id, "manage"),
        )
      : [];
    // Read-only overview fields. Keep the existing actor checks and scope filtering above.
    const target = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            image: true,
            status: true,
            isSystemAdmin: true,
            isSuperAdmin: true,
          },
        })
      : null;
    const questionnaireGrants =
      userId && access.isPlatformAdmin
        ? await prisma.corpus_collection_activity_permissions.findMany({
            where: { user_id: userId, can_view_insights: true },
            select: {
              activity_id: true,
              can_view_insights: true,
              can_export_insights: true,
            },
          })
        : null;
    return NextResponse.json(
      jsonSnapshot({
        roles,
        target: target
          ? {
              ...userSearchSummary(target),
              image: target.image,
              status: target.status,
              isSuperAdmin: target.isSuperAdmin,
            }
          : null,
        questionnaireGrants,
        grants,
        datasets,
        activities,
        isPlatformAdmin: access.isPlatformAdmin,
      }),
    );
  });
}
export async function PUT(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const parsed = grantSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AccessError(400, "授权参数无效");
    const result = await prisma.$transaction(
      (tx) => configureGrant(tx, session.user.id!, parsed.data),
      { timeout: 20000 },
    );
    return NextResponse.json(jsonSnapshot({ success: true, grant: result }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (!(error instanceof AccessError))
      console.error("Business permission update failed", error);
    return NextResponse.json(
      { error: error instanceof AccessError ? error.message : "授权失败" },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}
