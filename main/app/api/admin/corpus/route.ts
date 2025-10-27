import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/admin/corpus
 * 获取语料库列表（支持分页、搜索、筛选）
 * 需要管理员权限
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const search = searchParams.get("search") || "";
      const category = searchParams.get("category") || "";

      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};

      if (search) {
        where.data = { contains: search, mode: "insensitive" };
      }

      if (category) {
        where.category = category;
      }

      // 并行查询总数和语料库列表
      const [total, corpusEntries] = await Promise.all([
        prisma.cantonese_corpus_all.count({ where }),
        prisma.cantonese_corpus_all.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            created_at: "desc",
          },
          select: {
            id: true,
            unique_id: true,
            data: true,
            note: true,
            category: true,
            tags: true,
            editable_level: true,
            liked_num: true,
            bookmark_num: true,
            view_num: true,
            created_at: true,
            _count: {
              select: {
                userInteractions: true,
              },
            },
          },
        }),
      ]);

      return NextResponse.json({
        corpus: corpusEntries.map((entry) => ({
          id: Number(entry.id),
          uniqueId: entry.unique_id,
          data: entry.data,
          note: entry.note,
          category: entry.category,
          tags: entry.tags,
          editableLevel: entry.editable_level,
          likedNum: Number(entry.liked_num),
          bookmarkNum: Number(entry.bookmark_num),
          viewNum: Number(entry.view_num),
          createdAt: entry.created_at,
          interactionsCount: entry._count.userInteractions,
        })),
        pagination: {
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch corpus:", error);
      return NextResponse.json(
        { error: "Failed to fetch corpus data" },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/admin/corpus
 * 删除语料库条目
 * 需要管理员权限
 */
export async function DELETE(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const uniqueId = searchParams.get("uniqueId");

      if (!uniqueId) {
        return NextResponse.json(
          { error: "Unique ID is required" },
          { status: 400 }
        );
      }

      await prisma.cantonese_corpus_all.delete({
        where: { unique_id: uniqueId },
      });

      return NextResponse.json({
        message: "Corpus entry deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete corpus:", error);
      return NextResponse.json(
        { error: "Failed to delete corpus entry" },
        { status: 500 }
      );
    }
  });
}
