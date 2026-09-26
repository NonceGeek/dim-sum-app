import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COLLECTION_ROLES,
  CollectionAccess,
  CollectionRole,
  allowedActivityIds,
  validActions,
} from "@/lib/collection-permissions";

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v)),
  );
}
export async function lockUsers(tx: Prisma.TransactionClient, ids: string[]) {
  // Permission edits and writes serialize on the same user rows, including revocation.
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  }
}
export async function loadSubmissionAccess(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<CollectionAccess> {
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
      grants: {},
    };
  const role = user.collectionOperatorRole;
  if (
    !role?.active ||
    !COLLECTION_ROLES.includes(role.role_code as CollectionRole)
  )
    throw new AccessError(403, "没有有效的活动运营角色");
  const permissions = await db.corpus_collection_activity_permissions.findMany({
    where: { user_id: userId },
  });
  return {
    userId,
    role: role.role_code,
    isAdmin: false,
    grants: Object.fromEntries(
      permissions.map((p) => [
        String(p.activity_id),
        validActions(p.submission_actions),
      ]),
    ),
  };
}
export function submissionScope(
  access: CollectionAccess,
): Prisma.corpus_collection_submissionsWhereInput {
  return access.isAdmin
    ? {}
    : { activity_id: { in: allowedActivityIds(access) } };
}
export function batchScope(
  access: CollectionAccess,
): Prisma.corpus_collection_review_batchesWhereInput {
  // Includes legacy mixed batches only when every member is visible. Empty batches are private.
  return access.isAdmin
    ? {}
    : { items: { some: {}, every: { submission: submissionScope(access) } } };
}
export async function audit(
  tx: Prisma.TransactionClient,
  access: CollectionAccess,
  action: string,
  options: {
    activityId?: bigint | null;
    submissionId?: bigint;
    before?: unknown;
    after?: unknown;
    note?: string;
    outcome?: string;
    summary?: unknown;
  } = {},
) {
  await tx.corpus_collection_audit_logs.create({
    data: {
      operator_id: access.userId,
      operator_role: access.role,
      action,
      activity_id: options.activityId,
      submission_id: options.submissionId,
      before_state: jsonSnapshot(options.before ?? {}),
      after_state: jsonSnapshot(options.after ?? {}),
      note: options.note,
      outcome: options.outcome ?? "success",
      result_summary: jsonSnapshot(options.summary ?? {}),
    },
  });
}
export async function withSubmissionAccess(
  req: NextRequest,
  handler: (access: CollectionAccess) => Promise<NextResponse>,
) {
  const session = await getAuthSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let access: CollectionAccess = {
    userId: session.user.id,
    role: "NONE",
    isAdmin: false,
    grants: {},
  };
  try {
    access = await loadSubmissionAccess(session.user.id);
    return await handler(access);
  } catch (error) {
    const known = error instanceof AccessError;
    if (req.method !== "GET") {
      await audit(prisma, access, "submission.request.failed", {
        outcome: known ? "denied" : "failed",
        summary: {
          path: new URL(req.url).pathname,
          reason: known ? error.message : "INTERNAL_ERROR",
        },
      });
    }
    if (!known) console.error("Submission operation failed", error);
    return NextResponse.json(
      { error: known ? error.message : "操作失败，请重试" },
      { status: known ? error.status : 500 },
    );
  }
}
export async function requireCollectionAdmin(
  req: NextRequest,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>,
) {
  return withSubmissionAccess(req, async (access) => {
    if (!access.isAdmin) throw new AccessError(403, "仅系统管理员可配置权限");
    return handler(req, access.userId);
  });
}
