import {
  assertDataset,
  datasetWhere,
  grantCreatedObject,
  withAdminAccess,
} from "@/lib/admin/access";
import { canCreate } from "@/lib/admin/policy";
import { AccessError } from "@/lib/admin/security";
import { parseDatasetUpdate } from "@/lib/dataset-management";
import { logPermissionChange } from "@/lib/permission";
import { PermissionAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET - 获取语料库分类列表
 */
export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";

      const categories = await db.cantonese_categories.findMany({
        where: {
          AND: [
            datasetWhere(access),
            search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { nickname: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        select: {
          id: true,
          name: true,
          nickname: true,
          description: true,
          content_attribute: true,
          activity: { select: { id: true, title: true } },
          libraryProfile: { select: { listed: true } },
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
          activity: cat.activity
            ? { id: cat.activity.id.toString(), title: cat.activity.title }
            : null,
          is_public: cat.is_public,
          libraryListed: cat.libraryProfile?.listed ?? false,
          created_at: cat.created_at,
          status: cat.status,
          corpusCount: cat._count.cantonese_corpus_all,
          permissionsCount: cat._count.userPermissions,
        })),
      });
    } catch (error) {
      if (error instanceof AccessError) throw error;
      console.error("Error getting categories:", error);
      return NextResponse.json(
        { error: "Failed to get categories" },
        { status: 500 },
      );
    }
  });
}

/**
 * PATCH - 更新语料库分类的公开状态
 */
export async function PATCH(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    try {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return NextResponse.json(
          { error: "Invalid dataset payload" },
          { status: 400 },
        );
      const { name } = body;
      let changes: ReturnType<typeof parseDatasetUpdate>;
      try {
        changes = parseDatasetUpdate(body);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid dataset" },
          { status: 400 },
        );
      }

      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { error: "Dataset name is required" },
          { status: 400 },
        );
      }

      await assertDataset(access, name, "manage", db);
      const updated = await (async (tx: typeof db) => {
        await tx.$queryRaw`select name from cantonese_categories where name = ${name} for update`;
        const previous = await tx.cantonese_categories.findUnique({
          where: { name },
        });
        if (!previous) return null;
        const next = await tx.cantonese_categories.update({
          where: { name },
          data: { ...changes, updated_at: new Date() },
        });
        await logPermissionChange(
          {
            operatorId: access.userId,
            targetUserId: access.userId,
            action: PermissionAction.MODIFY,
            categoryName: name,
            oldValue: {
              nickname: previous.nickname,
              description: previous.description,
              contentAttribute: previous.content_attribute,
              is_public: previous.is_public,
            },
            newValue: {
              nickname: next.nickname,
              description: next.description,
              contentAttribute: next.content_attribute,
              is_public: next.is_public,
            },
          },
          tx,
        );
        return next;
      })(db);
      if (!updated)
        return NextResponse.json(
          { error: "Dataset not found" },
          { status: 404 },
        );
      revalidatePath("/[locale]/(home)/entries/[entryId]", "page");
      revalidatePath("/[locale]/(home)/search", "page");
      return NextResponse.json({ success: true, is_public: updated.is_public });
    } catch (error) {
      if (error instanceof AccessError) throw error;
      console.error("Error updating category:", error);
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 },
      );
    }
  });
}

/** Create a dataset without publishing it; grant its creator admin scope atomically. */
export async function POST(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    if (!canCreate(access, "dataset"))
      throw new AccessError(403, "需要语料管理员角色");
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(body.name) ||
      typeof body.nickname !== "string" ||
      !body.nickname.trim() ||
      body.nickname.length > 100 ||
      !["oral", "cultural_knowledge"].includes(body.contentAttribute)
    )
      throw new AccessError(400, "请填写有效标识、名称和语料大类");
    if (
      await db.cantonese_categories.findUnique({
        where: { name: body.name },
        select: { name: true },
      })
    )
      throw new AccessError(409, "语料集标识已存在");
    const category = await db.cantonese_categories.create({
      data: {
        name: body.name,
        nickname: body.nickname.trim(),
        content_attribute: body.contentAttribute,
        created_by: access.userId,
        is_public: false,
        if_in_all_data: false,
      },
    });
    await grantCreatedObject(db, access.userId, "dataset", category.id);
    return NextResponse.json(
      { id: String(category.id), name: category.name },
      { status: 201 },
    );
  });
}
