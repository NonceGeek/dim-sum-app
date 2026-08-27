import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/users
 * 获取用户列表（支持分页、搜索、筛选）
 * 需要管理员权限
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const search = searchParams.get("search") || "";
      const role = searchParams.get("role") || "";

      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      if (role) {
        where.role = role;
      }

      // 排除已合并（软删除）的账号
      where.status = { not: "MERGED" };

      // 使用同一连接读取总数和分页列表，避免连接池扇出。
      const [total, users] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isSystemAdmin: true,
            image: true,
            wechatAvatar: true,
            phoneNumber: true,
            createdAt: true,
            _count: {
              select: {
                corpusInteractions: true,
              },
            },
          },
        }),
      ]);

      return NextResponse.json({
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isSystemAdmin: user.isSystemAdmin,
          avatar: user.image || user.wechatAvatar,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          interactionsCount: user._count.corpusInteractions,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/admin/users
 * 更新用户信息（角色、管理员状态等）
 * 需要管理员权限
 */
export async function PATCH(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const body = await req.json();
      const { userId, role, isSystemAdmin } = body;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      // 管理员任免只能通过超级管理员专用接口完成。
      if (isSystemAdmin !== undefined) {
        return NextResponse.json(
          { error: "Only super admins can manage administrator access" },
          { status: 403 }
        );
      }

      const updateData: any = {};
      if (role !== undefined) updateData.role = role;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSystemAdmin: true,
        },
      });

      return NextResponse.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
  });
}
