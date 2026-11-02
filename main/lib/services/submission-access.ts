import { getAuthSession } from "@/lib/auth";
import {
	CollectionAccess,
	allowedActivityIds
} from "@/lib/collection-permissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

import { loadAdminAccess } from "@/lib/admin/access";
import { activityActions } from "@/lib/admin/policy";
import { AccessError,jsonSnapshot } from "@/lib/admin/security";
export { AccessError,jsonSnapshot,lockUsers } from "@/lib/admin/security";
export async function loadSubmissionAccess(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<CollectionAccess> {
  const access = await loadAdminAccess(userId, db);
  if (access.isPlatformAdmin) return { userId, role: access.isSuperAdmin ? "SUPER_ADMIN" : "SYSTEM_ADMIN", isAdmin: true, grants: {} };
  const grants = Object.fromEntries(access.grants.filter(g => g.scopeType === "activity").map(g => [g.scopeId, activityActions(access, g.scopeId)]).filter(([, actions]) => (actions as string[]).length));
  if (!Object.keys(grants).length && !access.businessRoles.includes("ACTIVITY_ADMIN")) throw new AccessError(403, "没有有效的活动权限");
  return { userId, role: access.businessRoles.includes("ACTIVITY_ADMIN") ? "ACTIVITY_ADMIN" : "ACTIVITY_OPERATOR", isAdmin: false, grants };
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
      scope_type: options.activityId ? "activity" : null,
      scope_id: options.activityId ? String(options.activityId) : null,
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
    if (!access.isAdmin) throw new AccessError(403, "仅平台管理员可配置权限");
    return handler(req, access.userId);
  });
}
