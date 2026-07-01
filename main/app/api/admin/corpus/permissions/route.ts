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

    // Check all users existence（排除已合并/软删除账号，禁止给其分配权限）
    const users = await prisma.user.findMany({
      where: { id: { in: targetUsers }, status: { not: "MERGED" } }
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

    // Helper function to execute transaction with retry logic
    const executeTransactionWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await prisma.$transaction(async (tx) => {
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

            // 分离需要创建和更新的记录
            const toCreate: Array<{ user_id: string; category_name: string; permission: any; created_by: string }> = [];
            const toUpdate: Array<{ user_id: string; category_name: string; permission: any; oldPermission: any }> = [];

            const auditLogs: Array<{
              operator_id: string;
              target_user_id: string;
              action: PermissionAction;
              category_name: string;
              old_value?: object;
              new_value: object;
            }> = [];

            // 预先分类所有操作
            for (const userId of targetUsers) {
              const effectivePermission = userPermissionMap.get(userId)!;

              for (const categoryName of targetCategories) {
                const key = `${userId}:${categoryName}`;
                const existingPermission = existingMap.get(key);

                if (existingPermission) {
                  // 需要更新
                  toUpdate.push({
                    user_id: userId,
                    category_name: categoryName,
                    permission: effectivePermission,
                    oldPermission: existingPermission.permission,
                  });

                  auditLogs.push({
                    operator_id: session.user.id!,
                    target_user_id: userId,
                    action: PermissionAction.MODIFY,
                    category_name: categoryName,
                    old_value: { permission: existingPermission.permission },
                    new_value: { permission: effectivePermission },
                  });
                } else {
                  // 需要创建
                  toCreate.push({
                    user_id: userId,
                    category_name: categoryName,
                    permission: effectivePermission,
                    created_by: session.user.id!,
                  });

                  auditLogs.push({
                    operator_id: session.user.id!,
                    target_user_id: userId,
                    action: PermissionAction.GRANT,
                    category_name: categoryName,
                    new_value: { permission: effectivePermission },
                  });
                }
              }
            }

            // 批量创建（使用 createMany，只需1次数据库操作）
            let createCount = 0;
            if (toCreate.length > 0) {
              const createResult = await tx.user_corpus_permissions.createMany({
                data: toCreate,
                skipDuplicates: true, // 跳过重复，防止冲突
              });
              createCount = createResult.count;
            }

            // 批量更新（使用 Promise.all 并行执行，而非串行）
            let updateCount = 0;
            if (toUpdate.length > 0) {
              // 将更新操作分批，每批10个，防止一次性太多
              const batchSize = 10;
              for (let i = 0; i < toUpdate.length; i += batchSize) {
                const batch = toUpdate.slice(i, i + batchSize);
                await Promise.all(
                  batch.map(item =>
                    tx.user_corpus_permissions.update({
                      where: {
                        user_id_category_name: {
                          user_id: item.user_id,
                          category_name: item.category_name,
                        },
                      },
                      data: { permission: item.permission },
                    })
                  )
                );
                updateCount += batch.length;
              }
            }

            const operationResults = { createCount, updateCount };

            // 优化 3: 批量插入审计日志，大幅减少数据库往返
            if (auditLogs.length > 0) {
              await tx.permission_audit_logs.createMany({
                data: auditLogs
              });
            }

            return operationResults;
          }, {
            maxWait: 5000, // Maximum time to wait for a transaction slot
            timeout: 60000, // 增加到60秒超时，适应批量操作
          });
        } catch (error: any) {
          // P2028: Transaction not found error
          if (error.code === 'P2028' && attempt < maxRetries) {
            console.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`);
            // Wait before retrying with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
            continue;
          }
          throw error;
        }
      }
      throw new Error('Transaction failed after maximum retries');
    };

    // Use transaction to ensure atomicity with increased timeout
    const results = await executeTransactionWithRetry();

    return NextResponse.json({
      success: true,
      count: results.createCount + results.updateCount,
      created: results.createCount,
      updated: results.updateCount,
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
