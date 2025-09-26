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
    const { data, category = "zyzdv2", note } = body;

    if (!data || !data.trim()) {
      return NextResponse.json({ error: "Data field is required" }, { status: 400 });
    }

    // 生成新的 unique_id
    const uniqueId = uuidv4();

    // 准备历史记录数据
    const noteData = {
      pinyin: note.pinyin || [],
      meaning: note.meaning || [],
      sentence: note.sentence || [],
      related_documents: note.related_documents || [],
      video_clips: note.video_clips || [],
      contributor: user.name || "Anonymous",
    };

    // 创建历史记录
    const historyRecord = await prisma.cantonese_corpus_update_history.create({
      data: {
        unique_id: uniqueId,
        note: noteData,
        status: "PENDING",
        user_id: session.user.id,
        last_note: {}, // 新增数据时，last_note 为空
        operation_type: "CREATE",
      },
    });

    return NextResponse.json({
      success: true,
      history_id: historyRecord.id.toString(),
      unique_id: uniqueId,
      status: historyRecord.status,
    });

  } catch (error) {
    console.error("Create data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}