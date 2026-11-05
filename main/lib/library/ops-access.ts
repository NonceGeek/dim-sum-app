import { loadAdminAccess } from "@/lib/admin/access";
import { hasDatasetAdmin } from "@/lib/admin/policy";
import { getAuthSession } from "@/lib/auth";
import {
	GlobalAction
} from "@/lib/collection-permissions";
import { prisma } from "@/lib/prisma";
import { AccessError } from "@/lib/services/submission-access";
import { Prisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

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
  const access = await loadAdminAccess(userId, db);
  if (!hasDatasetAdmin(access)) throw new AccessError(403, "需要语料管理员角色");
  return { userId, role: access.isPlatformAdmin ? "SYSTEM_ADMIN" : "DATASET_ADMIN", isAdmin: access.isPlatformAdmin, actions: ["contribution_review", "ingestion_assignee"] };

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
          adminBusinessRoles: { some: { active: true, role: "DATASET_ADMIN" } },
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
