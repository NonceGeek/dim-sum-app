import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const body = await req.json();
      const { corpus_unique_id, is_liked, is_bookmarked } = body;

      if (!corpus_unique_id) {
        return NextResponse.json(
          { error: "corpus_unique_id is required" },
          { status: 400 }
        );
      }

      // 验证语料是否存在
      const corpusExists = await prisma.cantonese_corpus_all.findUnique({
        where: { unique_id: corpus_unique_id },
        select: { unique_id: true, category: true }
      });

      if (!corpusExists) {
        return NextResponse.json(
          { error: "Corpus not found" },
          { status: 404 }
        );
      }

      // 使用事务来确保数据一致性
      const result = await prisma.$transaction(async (tx) => {
        // 获取当前用户的互动记录
        const currentInteraction = await tx.user_corpus_interactions.findUnique({
          where: {
            user_id_corpus_unique_id: {
              user_id: userId,
              corpus_unique_id: corpus_unique_id
            }
          },
          select: {
            is_liked: true,
            is_bookmarked: true
          }
        });

        // 构建更新对象，只包含传入的字段
        const updateData: any = { updated_at: new Date() };
        if (is_liked !== undefined) {
          updateData.is_liked = is_liked;
        }
        if (is_bookmarked !== undefined) {
          updateData.is_bookmarked = is_bookmarked;
        }

        // 更新或创建用户互动记录
        const interaction = await tx.user_corpus_interactions.upsert({
          where: {
            user_id_corpus_unique_id: {
              user_id: userId,
              corpus_unique_id: corpus_unique_id
            }
          },
          update: updateData,
          create: {
            user_id: userId,
            corpus_unique_id: corpus_unique_id,
            category: corpusExists.category,
            is_liked: is_liked || false,
            is_bookmarked: is_bookmarked || false,
            is_viewed: false
          },
          select: {
            is_liked: true,
            is_bookmarked: true,
            is_viewed: true,
            created_at: true,
            updated_at: true
          }
        });

        // 计算计数器变化
        const corpusUpdateData: any = {};
        
        // 处理点赞计数
        if (is_liked !== undefined) {
          if (currentInteraction) {
            // 更新现有记录
            if (is_liked && !currentInteraction.is_liked) {
              corpusUpdateData.liked_num = { increment: 1 };
            } else if (!is_liked && currentInteraction.is_liked) {
              corpusUpdateData.liked_num = { decrement: 1 };
            }
          } else if (is_liked) {
            // 新建记录且点赞
            corpusUpdateData.liked_num = { increment: 1 };
          }
        }

        // 处理收藏计数
        if (is_bookmarked !== undefined) {
          if (currentInteraction) {
            // 更新现有记录
            if (is_bookmarked && !currentInteraction.is_bookmarked) {
              corpusUpdateData.bookmark_num = { increment: 1 };
            } else if (!is_bookmarked && currentInteraction.is_bookmarked) {
              corpusUpdateData.bookmark_num = { decrement: 1 };
            }
          } else if (is_bookmarked) {
            // 新建记录且收藏
            corpusUpdateData.bookmark_num = { increment: 1 };
          }
        }

        // 注意：is_viewed 的更新已移至公共接口 /api/public/corpus/view

        // 更新语料计数器
        if (Object.keys(corpusUpdateData).length > 0) {
          await tx.cantonese_corpus_all.update({
            where: { unique_id: corpus_unique_id },
            data: corpusUpdateData
          });
        }

        return interaction;
      });

      return NextResponse.json({
        success: true,
        interaction: { ...result, corpus_unique_id },
      });
    } catch (error) {
      console.error('Error updating corpus interaction:', error);
      return NextResponse.json(
        { error: "Failed to update interaction" },
        { status: 500 }
      );
    }
  });
}

export async function GET(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const { searchParams } = new URL(req.url);
      const corpus_unique_id = searchParams.get("corpus_unique_id");
      const type = searchParams.get("type"); // 'bookmarked', 'liked', or specific corpus
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const search = searchParams.get("search") || "";

      // 查询特定语料的用户互动状态
      if (corpus_unique_id) {
        const interaction = await prisma.user_corpus_interactions.findUnique({
          where: {
            user_id_corpus_unique_id: {
              user_id: userId,
              corpus_unique_id: corpus_unique_id
            }
          },
          select: {
            is_liked: true,
            is_bookmarked: true,
            is_viewed: true,
            created_at: true,
            updated_at: true
          }
        });

        return NextResponse.json({
          corpus_unique_id,
          interaction: interaction || {
            is_liked: false,
            is_bookmarked: false,
            is_viewed: false,
            created_at: null,
            updated_at: null
          }
        });
      }

      // 查询用户的收藏或点赞列表
      if (type === "bookmarked" || type === "liked") {
        const whereCondition = {
          user_id: userId,
          ...(type === "bookmarked"
            ? { is_bookmarked: true }
            : { is_liked: true }),
        };

        const whereConditionWithSearch = {
          ...whereCondition,
          ...(search
            ? {
                corpus: {
                  is: {
                    data: {
                      contains: search,
                      mode: "insensitive", // 可选，不区分大小写
                    },
                  },
                },
              }
            : {}),
        };

        const finalWhere = search ? whereConditionWithSearch : whereCondition;

        const offset = (page - 1) * limit;

        const [interactions, total] = await Promise.all([
          prisma.user_corpus_interactions.findMany({
            where: finalWhere,
            include: {
              corpus: {
                select: {
                  unique_id: true,
                  data: true,
                  note: true,
                  category: true,
                  created_at: true,
                  tags: true,
                  editable_level: true,
                  liked_num: true,
                  bookmark_num: true,
                  view_num: true,
                },
              },
            },
            orderBy: {
              updated_at: "desc",
            },
            skip: offset,
            take: limit,
          }),
          prisma.user_corpus_interactions.count({
            where: finalWhere,
          }),
        ]);

        const results = interactions.map((interaction) => ({
          interaction_id: interaction.id.toString(),
          is_liked: interaction.is_liked,
          is_bookmarked: interaction.is_bookmarked,
          is_viewed: interaction.is_viewed,
          interaction_created_at: interaction.created_at,
          interaction_updated_at: interaction.updated_at,
          corpus: {
            ...interaction.corpus,
            liked_num: interaction.corpus.liked_num.toString(),
            bookmark_num: interaction.corpus.bookmark_num.toString(),
            view_num: interaction.corpus.view_num.toString(),
          },
        }));

        return NextResponse.json({
          type,
          results,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit)
          }
        });
      }

      return NextResponse.json(
        { error: "Please specify corpus_unique_id or type parameter (bookmarked/liked)" },
        { status: 400 }
      );
    } catch (error) {
      console.error('Error fetching user interactions:', error);
      return NextResponse.json(
        { error: "Failed to fetch interactions" },
        { status: 500 }
      );
    }
  });
}