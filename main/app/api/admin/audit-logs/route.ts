import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET - 获取审计日志列表
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSystemAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get("operator_id");
    const targetUserId = searchParams.get("target_user_id");
    const categoryName = searchParams.get("category_name");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 构建查询条件
    const whereClause: Record<string, unknown> = {};
    if (operatorId) whereClause.operator_id = operatorId;
    if (targetUserId) whereClause.target_user_id = targetUserId;
    if (categoryName) whereClause.category_name = categoryName;

    const [logs, total] = await Promise.all([
      prisma.permission_audit_logs.findMany({
        where: whereClause,
        include: {
          operator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          target_user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.permission_audit_logs.count({ where: whereClause }),
    ]);

    // 转换 BigInt 为 Number
    const serializedLogs = logs.map((log) => ({
      id: Number(log.id),
      operator_id: log.operator_id,
      target_user_id: log.target_user_id,
      category_name: log.category_name,
      action: log.action,
      old_value: log.old_value,
      new_value: log.new_value,
      created_at: log.created_at,
      operator: log.operator,
      target_user: log.target_user,
    }));

    return NextResponse.json({
      logs: serializedLogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting audit logs:", error);
    return NextResponse.json(
      { error: "Failed to get audit logs" },
      { status: 500 },
    );
  }
}
