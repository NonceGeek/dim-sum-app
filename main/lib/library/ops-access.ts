import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COLLECTION_ROLES,
  CollectionRole,
  GlobalAction,
  validGlobalActions,
} from "@/lib/collection-permissions";
import { AccessError } from "@/lib/services/submission-access";

export type LibraryOpsAccess = {
  userId: string;
  role: string;
  isAdmin: boolean;
  actions: GlobalAction[];
};

/** Reads the current grant on every request so revocation applies immediately. */
export async function loadLibraryOpsAccess(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<LibraryOpsAccess> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      isSystemAdmin: true,
      isSuperAdmin: true,
      collectionOperatorRole: true,
    },
  });
  if (!user || user.status !== "ACTIVE")
    throw new AccessError(403, "账号不可用");
  if (user.isSystemAdmin || user.isSuperAdmin)
    return {
      userId,
      role: user.isSuperAdmin ? "SUPER_ADMIN" : "SYSTEM_ADMIN",
      isAdmin: true,
      actions: ["contribution_review", "ingestion_assignee"],
    };
  const role = user.collectionOperatorRole;
  if (!role?.active || !COLLECTION_ROLES.includes(role.role_code as CollectionRole))
    throw new AccessError(403, "没有有效的运营角色");
  const actions = validGlobalActions(role.global_actions);
  if (!actions.length) throw new AccessError(403, "没有语料运营权限");
  return { userId, role: role.role_code, isAdmin: false, actions };
}

export function can(access: LibraryOpsAccess, action: GlobalAction) {
  return access.isAdmin || access.actions.includes(action);
}

export function requireCapability(
  access: LibraryOpsAccess,
  action: GlobalAction,
) {
  if (!can(access, action)) throw new AccessError(403, "没有该操作权限");
}

/** Users who currently hold a capability (admins always qualify). */
export async function usersWithCapability(action: GlobalAction) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { isSystemAdmin: true },
        { isSuperAdmin: true },
        {
          collectionOperatorRole: {
            active: true,
            role_code: { in: [...COLLECTION_ROLES] },
            global_actions: { has: action },
          },
        },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200,
  });
  return users;
}

export async function assertUserHasCapability(
  tx: Prisma.TransactionClient,
  userId: string,
  action: GlobalAction,
) {
  const access = await loadLibraryOpsAccess(userId, tx).catch(() => null);
  if (!access || !can(access, action))
    throw new AccessError(400, "所选人员没有对应的运营权限");
}

export async function withLibraryOps(
  req: NextRequest,
  handler: (access: LibraryOpsAccess) => Promise<NextResponse>,
) {
  const session = await getAuthSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const access = await loadLibraryOpsAccess(session.user.id);
    return await handler(access);
  } catch (error) {
    if (error instanceof AccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2024"
    )
      return NextResponse.json(
        { error: "系统繁忙，请稍后重试" },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    console.error("Library ops request failed", error);
    return NextResponse.json({ error: "操作失败，请重试" }, { status: 500 });
  }
}

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;
