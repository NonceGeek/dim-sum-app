import { scopeIds } from "@/lib/admin/policy";
import { AccessError } from "@/lib/admin/security";
import { activityWhere,assertScope,withAdminAccess } from "@/lib/admin/access";
import type { Prisma as AdminPrisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  activityId: z.string().regex(/^[1-9]\d*$/).optional(),
  enabled: z.boolean(),
}).strict();

export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    const activities = await db.corpus_collection_activities.findMany({
      where: activityWhere(access, "manage"),
      select: {
        id: true,
        title: true,
        status: true,
        tags: true,
        questionnaire_gate_enabled: true,
      },
      orderBy: { created_at: "desc" },
    });
    const enabledCount = activities.filter((activity) => activity.questionnaire_gate_enabled).length;
    return NextResponse.json({
      summary: {
        total: activities.length,
        enabled: enabledCount,
        disabled: activities.length - enabledCount,
        allEnabled: enabledCount === activities.length,
      },
      activities: activities.map((activity) => ({
        id: activity.id.toString(),
        title: activity.title,
        status: activity.status,
        activityTag:
          Array.isArray(activity.tags) && typeof activity.tags[0] === "string"
            ? activity.tags[0]
            : null,
        questionnaireGateEnabled: activity.questionnaire_gate_enabled,
      })),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    const operatorId = access.userId;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const activityId = parsed.data.activityId ? BigInt(parsed.data.activityId) : null;
    if (activityId) {
      assertScope(access, "activity", activityId, "manage");
      const activity = await db.corpus_collection_activities.findUnique({
        where: { id: activityId },
        select: { id: true },
      });
      if (!activity) {
        return NextResponse.json({ error: "ACTIVITY_NOT_FOUND" }, { status: 404 });
      }
    }
    if (!activityId && !access.isPlatformAdmin) {
      const ids = scopeIds(access, "activity", "manage") ?? [];
      if (!ids.length) throw new AccessError(403, "没有可管理的活动");
      for (const id of ids) assertScope(access, "activity", id, "manage");
    }
    const result = await (async (tx: AdminPrisma.TransactionClient) => {
      const updateResult = await tx.corpus_collection_activities.updateMany({
        where: activityId ? { id: activityId } : activityWhere(access, "manage"),
        data: { questionnaire_gate_enabled: parsed.data.enabled },
      });
      await tx.corpus_collection_audit_logs.create({
        data: {
          operator_id: operatorId,
          action: "questionnaire.gate.updated",
          activity_id: activityId,
          filters: {},
          result_summary: {
            scope: activityId ? "activity" : "all",
            enabled: parsed.data.enabled,
            affectedCount: updateResult.count,
          },
        },
      });
      return updateResult;
    })(db);
    return NextResponse.json({
      success: true,
      affectedCount: result.count,
      enabled: parsed.data.enabled,
    });
  });
}
