import { NextRequest, NextResponse } from "next/server";
import { publicApi, getAuthSession } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const unique_id = searchParams.get('unique_id');

    if (!unique_id) {
      return NextResponse.json(
        { error: "unique_id parameter is required" },
        { status: 400 }
      );
    }

    try {
      // 检查用户是否登录
      const session = await getAuthSession();
      const userId = session?.user?.id;

      // 查询语料的点赞数和收藏数
      const interactions = await prisma.user_corpus_interactions.findMany({
        where: {
          corpus_unique_id: unique_id
        },
        select: {
          is_liked: true,
          is_bookmarked: true
        }
      });

      const likeCount = interactions.filter(i => i.is_liked).length;
      const bookmarkCount = interactions.filter(i => i.is_bookmarked).length;

      // 如果用户已登录，查询用户的点赞和收藏状态
      let userInteraction = null;
      if (userId) {
        userInteraction = await prisma.user_corpus_interactions.findUnique({
          where: {
            user_id_corpus_unique_id: {
              user_id: userId,
              corpus_unique_id: unique_id
            }
          },
          select: {
            is_liked: true,
            is_bookmarked: true
          }
        });
      }

      return NextResponse.json({
        unique_id,
        stats: {
          likes: likeCount,
          bookmarks: bookmarkCount
        },
        user_status: userInteraction ? {
          is_liked: userInteraction.is_liked,
          is_bookmarked: userInteraction.is_bookmarked
        } : null
      });
    } catch (error) {
      console.error('Error fetching corpus stats:', error);
      return NextResponse.json(
        { error: "Failed to fetch corpus stats" },
        { status: 500 }
      );
    }
  });
}