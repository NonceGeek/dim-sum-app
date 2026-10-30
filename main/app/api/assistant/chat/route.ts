import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStreamResponse, toUIMessageStream, type ModelMessage } from "ai";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamAssistant, summarizeSteps } from "@/lib/assistant/agent";
import { stripJyutping, type Block } from "@/lib/assistant/blocks";
import {
  ensureConversation,
  groundingFromHistory,
  loadRecentMessages,
  toModelMessages,
} from "@/lib/assistant/conversation";
import { getAssistantModel, getAssistantModelId } from "@/lib/assistant/model";
import { getQuota } from "@/lib/assistant/quota";
import type { ToolTraceItem } from "@/lib/assistant/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  id: z.string().uuid(),
  message: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(500) }),
    // 组件内操作，例如答题结果；label 是给用户和模型看的描述
    z.object({ kind: z.literal("action"), label: z.string().trim().min(1).max(1000) }),
  ]),
});

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    const parsed = requestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { id, message } = parsed.data;
    const content = message.kind === "text" ? message.text : message.label;

    const quota = await getQuota(userId);
    if (quota.remaining <= 0) {
      return NextResponse.json(
        { error: "Daily limit reached", code: "QUOTA_EXCEEDED", quota },
        { status: 429 },
      );
    }

    try {
      getAssistantModel();
    } catch (error) {
      console.error("Assistant model unavailable:", error);
      return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });
    }

    const conversation = await ensureConversation(id, userId, content);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const history = await loadRecentMessages(conversation.id);
    await prisma.assistant_messages.create({
      data: {
        conversation_id: conversation.id,
        user_id: userId,
        role: message.kind === "text" ? "user" : "action",
        content,
      },
    });

    const messages: ModelMessage[] = [
      ...toModelMessages(history),
      ...toModelMessages([
        { id: "pending", role: message.kind === "text" ? "user" : "action", content, blocks: [], created_at: new Date() },
      ]),
    ];
    const trace: ToolTraceItem[] = [];
    const startedAt = Date.now();
    const modelId = getAssistantModelId();

    const { result, tools } = streamAssistant({
      messages,
      grounding: groundingFromHistory(history),
      trace,
      onEnd: async ({ steps, totalUsage }) => {
        const timing = summarizeSteps(steps);
        console.info("Assistant timing", JSON.stringify({ conversationId: conversation.id, ...timing }));
        const text = stripJyutping(steps.map((step) => step.text).join("\n")).text;
        const declared: Block[] = steps.flatMap((step) =>
          step.toolResults.flatMap((toolResult) =>
            toolResult.toolName === "show_blocks" && !toolResult.dynamic
              ? (toolResult.output as { declared: Block[] }).declared
              : [],
          ),
        );
        try {
          await prisma.$transaction([
            prisma.assistant_messages.create({
              data: {
                conversation_id: conversation.id,
                user_id: userId,
                role: "assistant",
                content: text,
                blocks: declared,
                tool_trace: { tools: trace, timing } as unknown as Prisma.InputJsonValue,
                model: modelId,
                input_tokens: totalUsage.inputTokens ?? null,
                output_tokens: totalUsage.outputTokens ?? null,
              },
            }),
            prisma.assistant_conversations.update({
              where: { id: conversation.id },
              data: { updated_at: new Date() },
            }),
          ]);
        } catch (error) {
          console.error("Failed to persist assistant message:", error);
        }
      },
    });
    // 客户端断开时仍跑完并落库
    void result.consumeStream();

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        tools,
        // 结束时把总用时与各次工具耗时随消息下发，前端显示“用时 X 秒”
        messageMetadata: ({ part }) =>
          part.type === "finish"
            ? {
                timing: {
                  elapsedMs: Date.now() - startedAt,
                  tools: trace
                    .filter((item) => item.tool !== "show_blocks")
                    .map((item) => ({ tool: item.tool, ms: item.ms ?? null })),
                },
              }
            : undefined,
        onError: (error) => {
          console.error("Assistant stream failed:", error);
          return "小助手暂时无法回答，请稍后再试。";
        },
      }),
    }) as NextResponse;
  });
}
