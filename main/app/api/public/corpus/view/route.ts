import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { corpus_unique_id } = body;

    if (!corpus_unique_id) {
      return NextResponse.json(
        { error: "corpus_unique_id is required" },
        { status: 400 }
      );
    }

    // 验证语料是否存在
    const corpusExists = await prisma.cantonese_corpus_all.findUnique({
      where: { unique_id: corpus_unique_id },
      select: { unique_id: true, category: true, view_num: true }
    });

    if (!corpusExists) {
      return NextResponse.json(
        { error: "Corpus not found" },
        { status: 404 }
      );
    }

    // 尝试获取当前用户会话（如果登录的话）
    const session = await getAuthSession();
    const userId = session?.user?.id;

    // 使用事务来确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      let userInteractionUpdated = false;

      // 如果用户已登录，记录/更新用户互动表
      if (userId) {
        const currentInteraction = await tx.user_corpus_interactions.findUnique({
          where: {
            user_id_corpus_unique_id: {
              user_id: userId,
              corpus_unique_id: corpus_unique_id
            }
          },
          select: { is_viewed: true }
        });

        // 如果用户还没有观看记录，创建或更新记录
        if (!currentInteraction || !currentInteraction.is_viewed) {
          await tx.user_corpus_interactions.upsert({
            where: {
              user_id_corpus_unique_id: {
                user_id: userId,
                corpus_unique_id: corpus_unique_id
              }
            },
            update: {
              is_viewed: true,
              updated_at: new Date()
            },
            create: {
              user_id: userId,
              corpus_unique_id: corpus_unique_id,
              category: corpusExists.category,
              is_liked: false,
              is_bookmarked: false,
              is_viewed: true
            }
          });
          userInteractionUpdated = true;
        }
      }

      // 无论用户是否登录，每次访问都增加语料的观看次数
      await tx.cantonese_corpus_all.update({
        where: { unique_id: corpus_unique_id },
        data: { view_num: { increment: 1 } }
      });

      return {
        corpus_unique_id,
        view_incremented: true,
        user_logged_in: !!userId,
        user_interaction_updated: userInteractionUpdated
      };
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error updating corpus view:', error);
    return NextResponse.json(
      { error: "Failed to update view count" },
      { status: 500 }
    );
  }
}