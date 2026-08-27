import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const permissionSchema = z.object({
  userId: z.string().min(1),
  activityId: z.string().regex(/^\d+$/),
  canViewInsights: z.boolean(),
  canExportInsights: z.boolean(),
}).strict();

function serializePermission(permission: {
  id: bigint;
  user_id: string;
  activity_id: bigint;
  can_view_insights: boolean;
  can_export_insights: boolean;
  created_at: Date;
  updated_at: Date;
  user: { name: string | null; email: string | null };
  activity: { title: string };
}) {
  return {
    id: permission.id.toString(),
    userId: permission.user_id,
    userName: permission.user.name,
    userEmail: permission.user.email,
    activityId: permission.activity_id.toString(),
    activityTitle: permission.activity.title,
    canViewInsights: permission.can_view_insights,
    canExportInsights: permission.can_export_insights,
    createdAt: permission.created_at.toISOString(),
    updatedAt: permission.updated_at.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const [permissions, users, activities] = await prisma.$transaction([
      prisma.corpus_collection_activity_permissions.findMany({
        include: {
          user: { select: { name: true, email: true } },
          activity: { select: { title: true } },
        },
        orderBy: [{ updated_at: "desc" }],
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, email: true, phoneNumber: true },
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        take: 500,
      }),
      prisma.corpus_collection_activities.findMany({
        select: { id: true, title: true, status: true },
        orderBy: { created_at: "desc" },
      }),
    ]);
    return NextResponse.json({
      permissions: permissions.map(serializePermission),
      users,
      activities: activities.map((activity) => ({
        id: activity.id.toString(),
        title: activity.title,
        status: activity.status,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return requireAdmin(req, async (_req, operatorId) => {
    const parsed = permissionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (parsed.data.canExportInsights && !parsed.data.canViewInsights) {
      return NextResponse.json(
        { error: "EXPORT_REQUIRES_VIEW_PERMISSION" },
        { status: 400 },
      );
    }
    const activityId = BigInt(parsed.data.activityId);
    const [user, activity, existingPermission] = await prisma.$transaction([
      prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, status: true } }),
      prisma.corpus_collection_activities.findUnique({ where: { id: activityId }, select: { id: true } }),
      prisma.corpus_collection_activity_permissions.findUnique({
        where: {
          user_id_activity_id: {
            user_id: parsed.data.userId,
            activity_id: activityId,
          },
        },
        select: { id: true },
      }),
    ]);
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }
    if (!activity) {
      return NextResponse.json({ error: "ACTIVITY_NOT_FOUND" }, { status: 404 });
    }
    const permission = await prisma.$transaction(async (tx) => {
      const saved = await tx.corpus_collection_activity_permissions.upsert({
        where: {
          user_id_activity_id: {
            user_id: parsed.data.userId,
            activity_id: activityId,
          },
        },
        create: {
          user_id: parsed.data.userId,
          activity_id: activityId,
          can_view_insights: parsed.data.canViewInsights,
          can_export_insights: parsed.data.canExportInsights,
          assigned_by: operatorId,
        },
        update: {
          can_view_insights: parsed.data.canViewInsights,
          can_export_insights: parsed.data.canExportInsights,
          assigned_by: operatorId,
        },
        include: {
          user: { select: { name: true, email: true } },
          activity: { select: { title: true } },
        },
      });
      await tx.corpus_collection_audit_logs.create({
        data: {
          operator_id: operatorId,
          action: existingPermission
            ? "questionnaire.activity_permission.updated"
            : "questionnaire.activity_permission.granted",
          activity_id: activityId,
          filters: {},
          result_summary: {
            permissionId: saved.id.toString(),
            granteeUserId: parsed.data.userId,
            canViewInsights: parsed.data.canViewInsights,
            canExportInsights: parsed.data.canExportInsights,
          },
        },
      });
      return saved;
    });
    return NextResponse.json({ permission: serializePermission(permission) });
  });
}

export async function DELETE(req: NextRequest) {
  return requireAdmin(req, async (_req, operatorId) => {
    const parsed = z.object({ permissionId: z.string().regex(/^\d+$/) }).strict().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const permissionId = BigInt(parsed.data.permissionId);
    const permission = await prisma.corpus_collection_activity_permissions.findUnique({
      where: { id: permissionId },
    });
    if (!permission) return NextResponse.json({ error: "PERMISSION_NOT_FOUND" }, { status: 404 });
    await prisma.$transaction([
      prisma.corpus_collection_activity_permissions.delete({ where: { id: permissionId } }),
      prisma.corpus_collection_audit_logs.create({
        data: {
          operator_id: operatorId,
          action: "questionnaire.activity_permission.revoked",
          activity_id: permission.activity_id,
          filters: {},
          result_summary: {
            permissionId: permission.id.toString(),
            granteeUserId: permission.user_id,
          },
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  });
}
