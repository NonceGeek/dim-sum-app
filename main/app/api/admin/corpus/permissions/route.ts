import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  PrismaClient,
  CorpusPermission,
  PermissionAction,
} from "@prisma/client";
import { logPermissionChange } from "@/lib/permission";

const prisma = new PrismaClient();

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
    const { user_id, category_name, permission } = body;

    if (!user_id || !category_name) {
      return NextResponse.json(
        { error: "user_id and category_name are required" },
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

    // 检查用户和分类是否存在
    const [user, category] = await Promise.all([
      prisma.user.findUnique({ where: { id: user_id } }),
      prisma.cantonese_categories.findFirst({ where: { name: category_name } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // 检查是否已存在权限
    const existingPermission = await prisma.user_corpus_permissions.findUnique({
      where: {
        user_id_category_name: { user_id, category_name },
      },
    });

    let result;
    let action: PermissionAction;
    let oldValue = null;

    if (existingPermission) {
      // 更新权限
      oldValue = { permission: existingPermission.permission };
      result = await prisma.user_corpus_permissions.update({
        where: {
          user_id_category_name: { user_id, category_name },
        },
        data: {
          permission: permission || CorpusPermission.READ,
        },
      });
      action = PermissionAction.MODIFY;
    } else {
      // 创建权限
      result = await prisma.user_corpus_permissions.create({
        data: {
          user_id,
          category_name,
          permission: permission || CorpusPermission.READ,
          created_by: session.user.id,
        },
      });
      action = PermissionAction.GRANT;
    }

    // 记录审计日志
    await logPermissionChange({
      operatorId: session.user.id!,
      targetUserId: user_id,
      action,
      categoryName: category_name,
      oldValue: oldValue ?? undefined,
      newValue: { permission: result.permission },
    });

    return NextResponse.json({
      success: true,
      permission: {
        id: Number(result.id),
        user_id: result.user_id,
        category_name: result.category_name,
        permission: result.permission,
      },
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
