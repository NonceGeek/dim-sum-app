import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { fetchAgentTaskStats } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  // corpusName: 语料库名称，多个名称用英文逗号分隔（必填）
  const corpusName = searchParams.get("corpusName");
  // assigneeRef: 标注员 ID，多个 ID 用英文逗号分隔；不传则统计所有标注员
  const assigneeRef = searchParams.get("assigneeRef");

  if (!corpusName) {
    return NextResponse.json(
      { error: "Missing required parameter: corpusName" },
      { status: 400 }
    );
  }

  return requireMiniprogramMarker(req, async () => {
    try {
      const data = await fetchAgentTaskStats({
        corpusName,
        assigneeRef: assigneeRef || undefined,
      });

      // 根据 assigneeRefs 查询用户名和头像
      const userIds = data.filters.assigneeRefs ?? [];
      const userMap: Record<
        string,
        { name: string | null; avatar: string | null }
      > = {};

      if (userIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true, wechatAvatar: true },
        });
        for (const u of users) {
          userMap[u.id] = {
            name: u.name,
            avatar: u.wechatAvatar || u.image,
          };
        }
      }

      return NextResponse.json({
        ...data,
        // assignees: 按 assigneeRefs 顺序返回用户信息（id / name / avatar）
        assignees: userIds.map((id) => ({
          id,
          name: userMap[id]?.name ?? null,
          avatar: userMap[id]?.avatar ?? null,
        })),
      });
    } catch (error) {
      return handleAgentApiError(error, "Failed to load task stats");
    }
  });
}
