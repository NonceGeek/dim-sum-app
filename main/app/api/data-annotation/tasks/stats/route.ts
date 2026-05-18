import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAgentTaskStats } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    const searchParams = new URL(req.url).searchParams;
    const corpusName = searchParams.get("corpusName");
    const assigneeRef = searchParams.get("assigneeRef");

    if (!corpusName) {
      return NextResponse.json(
        { error: "Missing required parameter: corpusName" },
        { status: 400 }
      );
    }

    try {
      const data = await fetchAgentTaskStats({
        corpusName,
        assigneeRef: assigneeRef || undefined,
      });

      // Match the mini-program flow: build the public user lookup from
      // assigneeRefs present in stats items, not only from filters metadata.
      const userIds = Array.from(
        new Set((data.items ?? []).map((item) => item.assigneeRef).filter(Boolean))
      );
      const userMap: Record<
        string,
        { name: string | null; avatar: string | null }
      > = {};

      if (userIds.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            id: { in: userIds },
            status: "ACTIVE",
          },
          select: { id: true, name: true, image: true, wechatAvatar: true },
        });
        for (const u of users) {
          userMap[u.id] = {
            name: u.name,
            avatar: u.wechatAvatar || u.image,
          };
        }
      }

      // Enrich per-user items with names/avatars
      const items = (data.items ?? []).map((item) => ({
        ...item,
        name: userMap[item.assigneeRef]?.name ?? null,
        avatar: userMap[item.assigneeRef]?.avatar ?? null,
      }));

      return NextResponse.json({
        ...data,
        items,
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
