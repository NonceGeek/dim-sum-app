import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { PermissionAction } from "@prisma/client";
import { logPermissionChange } from "@/lib/permission";
import { prisma } from "@/lib/prisma";

/**
 * GET - 获取语料库分类列表
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
    const search = searchParams.get("search") || "";

    const categories = await prisma.cantonese_categories.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { nickname: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        nickname: true,
        description: true,
        is_public: true,
        created_at: true,
        status: true,
        _count: {
          select: {
            cantonese_corpus_all: true,
            userPermissions: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      categories: categories.map((cat) => ({
        id: Number(cat.id),
        name: cat.name,
        nickname: cat.nickname,
        description: cat.description,
        is_public: cat.is_public,
        created_at: cat.created_at,
        status: cat.status,
        corpusCount: cat._count.cantonese_corpus_all,
        permissionsCount: cat._count.userPermissions,
      })),
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    return NextResponse.json(
      { error: "Failed to get categories" },
      { status: 500 },
    );
  }
}

/**
 * PATCH - 更新语料库分类的公开状态
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSystemAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name, is_public } = body;

    if (!name || typeof is_public !== "boolean") {
      return NextResponse.json(
        { error: "name and is_public are required" },
        { status: 400 },
      );
    }

    // 获取当前状态
    const category = await prisma.cantonese_categories.findFirst({
      where: { name },
      select: { is_public: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // 更新状态
    await prisma.cantonese_categories.updateMany({
      where: { name },
      data: { is_public },
    });

    // 记录审计日志 - 使用特殊的 action 表示公开状态变更
    await logPermissionChange({
      operatorId: session.user.id!,
      targetUserId: session.user.id!, // 操作者即目标
      action: PermissionAction.MODIFY,
      categoryName: name,
      oldValue: { is_public: category.is_public },
      newValue: { is_public },
    });

    return NextResponse.json({ success: true, is_public });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}
