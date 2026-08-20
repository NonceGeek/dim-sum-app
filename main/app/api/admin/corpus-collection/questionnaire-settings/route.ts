import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  activityId: z.string().regex(/^\d+$/).optional(),
  enabled: z.boolean(),
}).strict();

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const activities = await prisma.corpus_collection_activities.findMany({
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
  return requireAdmin(req, async (_req, operatorId) => {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const activityId = parsed.data.activityId ? BigInt(parsed.data.activityId) : null;
    if (activityId) {
      const activity = await prisma.corpus_collection_activities.findUnique({
        where: { id: activityId },
        select: { id: true },
      });
      if (!activity) {
        return NextResponse.json({ error: "ACTIVITY_NOT_FOUND" }, { status: 404 });
      }
    }
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.corpus_collection_activities.updateMany({
        where: activityId ? { id: activityId } : undefined,
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
    });
    return NextResponse.json({
      success: true,
      affectedCount: result.count,
      enabled: parsed.data.enabled,
    });
  });
}
