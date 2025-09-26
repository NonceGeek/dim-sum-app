import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 检查用户权限
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !["TAGGER_PARTNER", "TAGGER_OUTSOURCING"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { data } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Data must be a non-empty array" }, { status: 400 });
    }

    const historyRecords = [];

    // 使用事务来确保数据一致性
    await prisma.$transaction(async (tx) => {
      for (const item of data) {
        const uniqueId = uuidv4();

        // 准备历史记录数据
        const noteData = {
          pinyin: item.pinyin || [],
          meaning: item.meaning || [],
          sentence: item.sentence || [],
          related_documents: item.related_documents || [],
          video_clips: item.video_clips || [],
          contributor: user.name || "Anonymous",
        };

        // 创建历史记录
        const historyRecord = await tx.cantonese_corpus_update_history.create({
          data: {
            unique_id: uniqueId,
            note: noteData,
            status: "PENDING",
            user_id: session.user.id,
            last_note: {}, // 新增数据时，last_note 为空
            operation_type: "CREATE",
          },
        });

        historyRecords.push({
          history_id: historyRecord.id.toString(),
          unique_id: uniqueId,
          data: item.data,
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: historyRecords.length,
      records: historyRecords,
    });

  } catch (error) {
    console.error("Batch create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}