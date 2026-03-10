import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  CorpusPermission,
  PermissionAction,
} from "@prisma/client";
import { logPermissionChange } from "@/lib/permission";
import { prisma } from "@/lib/prisma";

/**
 * GET - 获取权限列表
 * 支持按用户或语料库查询
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
    const userId = searchParams.get("user_id");
    const categoryName = searchParams.get("category_name");

    let whereClause = {};
    if (userId) {
      whereClause = { user_id: userId };
    } else if (categoryName) {
      whereClause = { category_name: categoryName };
    }

    const permissions = await prisma.user_corpus_permissions.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        category: {
          select: {
            name: true,
            nickname: true,
            is_public: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // 转换 BigInt 为 Number
    const serializedPermissions = permissions.map((p) => ({
      id: Number(p.id),
      user_id: p.user_id,
      category_name: p.category_name,
      permission: p.permission,
      created_at: p.created_at,
      updated_at: p.updated_at,
      user: p.user,
      category: p.category,
    }));

    return NextResponse.json({ permissions: serializedPermissions });
  } catch (error) {
    console.error("Error getting permissions:", error);
    return NextResponse.json(
      { error: "Failed to get permissions" },
      { status: 500 },
    );
  }
}

/**
 * POST - 分配权限
 */
/**
 * POST - 分配权限
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSystemAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { user_id, user_ids, category_name, category_names, permission } = body;

    // Support both single and multiple users
    const targetUsers: string[] = user_ids || (user_id ? [user_id] : []);

    // Support both single category (legacy) and multiple categories
    const targetCategories: string[] = category_names || (category_name ? [category_name] : []);

    if (targetUsers.length === 0 || targetCategories.length === 0) {
      return NextResponse.json(
        { error: "At least one user_id and one category are required" },
        { status: 400 },
      );
    }

    // 验证权限值
    if (permission && !Object.values(CorpusPermission).includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission value" },
        { status: 400 },
      );
    }

    // Check all users existence
    const users = await prisma.user.findMany({
      where: { id: { in: targetUsers } }
    });

    if (users.length !== targetUsers.length) {
      return NextResponse.json({ error: "One or more users not found" }, { status: 404 });
    }

    // 禁止给 LEARNER 分配权限
    const learnerUsers = users.filter(u => u.role === "LEARNER");
    if (learnerUsers.length > 0) {
      return NextResponse.json(
        { error: `Cannot assign permissions to LEARNER users: ${learnerUsers.map(u => u.name || u.email).join(', ')}` },
        { status: 400 },
      );
    }

    // Check all categories existence
    const categories = await prisma.cantonese_categories.findMany({
      where: { name: { in: targetCategories } }
    });

    if (categories.length !== targetCategories.length) {
       return NextResponse.json(
        { error: "One or more categories not found" },
        { status: 404 },
      );
    }

    // 创建用户角色到权限的映射
    const userPermissionMap = new Map<string, CorpusPermission>();
    users.forEach(user => {
      let effectivePermission: CorpusPermission;
      if (user.role === "RESEARCHER") {
        effectivePermission = CorpusPermission.CREATE;
      } else if (
        user.role === "TAGGER_PARTNER" ||
        user.role === "TAGGER_OUTSOURCING"
      ) {
        effectivePermission = CorpusPermission.WRITE;
      } else {
        // 超级管理员或其他角色使用请求的权限或默认 READ
        effectivePermission = permission || CorpusPermission.READ;
      }
      userPermissionMap.set(user.id, effectivePermission);
    });

    // Use transaction to ensure atomicity with increased timeout
    const results = await prisma.$transaction(async (tx) => {
      // 优化 1: 批量预查询所有现有权限，减少数据库往返
      const existingPermissions = await tx.user_corpus_permissions.findMany({
        where: {
          user_id: { in: targetUsers },
          category_name: { in: targetCategories }
        }
      });

      // 构建快速查询索引 Map
      const existingMap = new Map<string, typeof existingPermissions[0]>(
        existingPermissions.map(p => [`${p.user_id}:${p.category_name}`, p])
      );

      const operationResults = [];
      const auditLogs: Array<{
        operator_id: string;
        target_user_id: string;
        action: PermissionAction;
        category_name: string;
        old_value?: object;
        new_value: object;
      }> = [];

      for (const userId of targetUsers) {
        const effectivePermission = userPermissionMap.get(userId)!;

        for (const categoryName of targetCategories) {
          const key = `${userId}:${categoryName}`;
          const existingPermission = existingMap.get(key);

          let result;
          let action: PermissionAction;
          let oldValue = null;

          if (existingPermission) {
            // 更新权限
            oldValue = { permission: existingPermission.permission };
            result = await tx.user_corpus_permissions.update({
              where: {
                user_id_category_name: { user_id: userId, category_name: categoryName },
              },
              data: {
                permission: effectivePermission,
              },
            });
            action = PermissionAction.MODIFY;
          } else {
            // 创建权限
            result = await tx.user_corpus_permissions.create({
              data: {
                user_id: userId,
                category_name: categoryName,
                permission: effectivePermission,
                created_by: session.user.id,
              },
            });
            action = PermissionAction.GRANT;
          }

          // 收集审计日志数据，稍后批量插入
          auditLogs.push({
            operator_id: session.user.id!,
            target_user_id: userId,
            action,
            category_name: categoryName,
            old_value: oldValue ?? undefined,
            new_value: { permission: result.permission },
          });

          operationResults.push(result);
        }
      }

      // 优化 3: 批量插入审计日志，大幅减少数据库往返
      if (auditLogs.length > 0) {
        await tx.permission_audit_logs.createMany({
          data: auditLogs
        });
      }

      return operationResults;
    }, {
      timeout: 30000, // 保留30秒超时作为安全边界
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      permissions: results.map(r => ({
        id: Number(r.id),
        user_id: r.user_id,
        category_name: r.category_name,
        permission: r.permission,
      }))
    });
  } catch (error) {
    console.error("Error assigning permission:", error);
    return NextResponse.json(
      { error: "Failed to assign permission" },
      { status: 500 },
    );
  }
}

/**
 * DELETE - 撤销权限
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSystemAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const categoryName = searchParams.get("category_name");

    if (!userId || !categoryName) {
      return NextResponse.json(
        { error: "user_id and category_name are required" },
        { status: 400 },
      );
    }

    // 获取现有权限
    const existingPermission = await prisma.user_corpus_permissions.findUnique({
      where: {
        user_id_category_name: { user_id: userId, category_name: categoryName },
      },
    });

    if (!existingPermission) {
      return NextResponse.json(
        { error: "Permission not found" },
        { status: 404 },
      );
    }

    // 删除权限
    await prisma.user_corpus_permissions.delete({
      where: {
        user_id_category_name: { user_id: userId, category_name: categoryName },
      },
    });

    // 记录审计日志
    await logPermissionChange({
      operatorId: session.user.id!,
      targetUserId: userId,
      action: PermissionAction.REVOKE,
      categoryName: categoryName,
      oldValue: { permission: existingPermission.permission },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking permission:", error);
    return NextResponse.json(
      { error: "Failed to revoke permission" },
      { status: 500 },
    );
  }
}
