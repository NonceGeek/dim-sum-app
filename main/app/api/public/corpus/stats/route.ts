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

      // 查询语料信息和统计数据
      const corpus = await prisma.cantonese_corpus_all.findUnique({
        where: { unique_id },
        select: {
          unique_id: true,
          liked_num: true,
          bookmark_num: true,
          view_num: true
        }
      });

      if (!corpus) {
        return NextResponse.json(
          { error: "Corpus not found" },
          { status: 404 }
        );
      }

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
            is_bookmarked: true,
            is_viewed: true
          }
        });
      }

      return NextResponse.json({
        unique_id,
        stats: {
          likes: Number(corpus.liked_num),
          bookmarks: Number(corpus.bookmark_num),
          views: Number(corpus.view_num)
        },
        user_status: userInteraction ? {
          is_liked: userInteraction.is_liked,
          is_bookmarked: userInteraction.is_bookmarked,
          is_viewed: userInteraction.is_viewed
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