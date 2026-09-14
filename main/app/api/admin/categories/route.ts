import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { PermissionAction } from "@prisma/client";
import { logPermissionChange } from "@/lib/permission";
import { parseDatasetUpdate } from "@/lib/dataset-management";
import { revalidatePath } from "next/cache";
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
        content_attribute: true,
        activity: { select: { id: true, title: true } },
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
        contentAttribute: cat.content_attribute,
        activity: cat.activity ? { id: cat.activity.id.toString(), title: cat.activity.title } : null,
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid dataset payload" }, { status: 400 });
    const { name } = body;
    let changes: ReturnType<typeof parseDatasetUpdate>;
    try { changes = parseDatasetUpdate(body); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid dataset" }, { status: 400 }); }

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Dataset name is required" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select name from cantonese_categories where name = ${name} for update`;
      const previous = await tx.cantonese_categories.findUnique({ where: { name } });
      if (!previous) return null;
      const next = await tx.cantonese_categories.update({ where: { name }, data: { ...changes, updated_at: new Date() } });
      await logPermissionChange({
        operatorId: session.user.id!, targetUserId: session.user.id!,
        action: PermissionAction.MODIFY, categoryName: name,
        oldValue: { nickname: previous.nickname, description: previous.description, contentAttribute: previous.content_attribute, is_public: previous.is_public },
        newValue: { nickname: next.nickname, description: next.description, contentAttribute: next.content_attribute, is_public: next.is_public },
      }, tx);
      return next;
    });
    if (!updated) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    revalidatePath("/[locale]/(home)/entries/[entryId]", "page");
    revalidatePath("/[locale]/(home)/search", "page");
    return NextResponse.json({ success: true, is_public: updated.is_public });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}
