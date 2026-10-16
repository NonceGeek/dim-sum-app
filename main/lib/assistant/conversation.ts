import type { ModelMessage, UIMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { corpusIdsOf, questionIdsOf, type Block, type Grounding } from "./blocks";
import { hydrateBlockGroups } from "./hydrate";

export const HISTORY_LIMIT = 12;
const TITLE_LENGTH = 30;

export type MessageRole = "user" | "assistant" | "action";

export type StoredMessage = {
  id: string;
  role: string;
  content: string;
  blocks: unknown;
  created_at: Date;
};

export type AssistantUIMessage = UIMessage<{ kind?: "action"; createdAt?: string }>;

export function storedBlocks(message: Pick<StoredMessage, "blocks">): Block[] {
  return Array.isArray(message.blocks) ? (message.blocks as Block[]) : [];
}

/** 查找当前用户的会话；不存在、已删除或属于他人时返回 null。 */
export async function findOwnedConversation(id: string, userId: string) {
  const conversation = await prisma.assistant_conversations.findUnique({ where: { id } });
  if (!conversation || conversation.deleted_at || conversation.user_id !== userId) {
    return null;
  }
  return conversation;
}

/**
 * 客户端为新会话生成 id；首条消息时创建会话。
 * id 已被他人或已删除会话占用时返回 null。
 */
export async function ensureConversation(id: string, userId: string, firstText: string) {
  const existing = await prisma.assistant_conversations.findUnique({ where: { id } });
  if (existing) {
    return existing.user_id === userId && !existing.deleted_at ? existing : null;
  }
  return prisma.assistant_conversations.create({
    data: { id, user_id: userId, title: firstText.trim().slice(0, TITLE_LENGTH) || null },
  });
}

export async function loadRecentMessages(conversationId: string, limit = HISTORY_LIMIT) {
  const rows = await prisma.assistant_messages.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: "desc" },
    take: limit,
    select: { id: true, role: true, content: true, blocks: true, created_at: true },
  });
  return rows.reverse();
}

function describeBlocks(blocks: Block[]): string {
  if (!blocks.length) return "";
  const parts = blocks.map((block) => {
    const ids = [...corpusIdsOf(block), ...questionIdsOf(block)];
    if (block.type === "corpus_results") return `corpus_results(${block.query})`;
    return ids.length ? `${block.type}(${ids.join(",")})` : block.type;
  });
  return `\n[已展示组件: ${parts.join("; ")}]`;
}

/** 历史消息转模型输入：组件只给出类型与 id 摘要，节省 token。 */
export function toModelMessages(rows: StoredMessage[]): ModelMessage[] {
  return rows.flatMap((row): ModelMessage[] => {
    if (row.role === "assistant") {
      const text = `${row.content}${describeBlocks(storedBlocks(row))}`.trim();
      return text ? [{ role: "assistant", content: text }] : [];
    }
    if (row.role === "action") {
      return [{ role: "user", content: `[用户在组件上的操作] ${row.content}` }];
    }
    return [{ role: "user", content: row.content }];
  });
}

/** 此前已展示过的 id 视为已接地，允许追问时直接复用。 */
export function groundingFromHistory(rows: StoredMessage[]): Grounding {
  const grounding: Grounding = { corpusIds: new Set(), questionIds: new Set() };
  for (const row of rows) {
    if (row.role !== "assistant") continue;
    for (const block of storedBlocks(row)) {
      corpusIdsOf(block).forEach((id) => grounding.corpusIds.add(id));
      questionIdsOf(block).forEach((id) => grounding.questionIds.add(id));
    }
  }
  return grounding;
}

/** 历史消息转前端 UIMessage；组件重新查库填充，保证展示的是最新数据。 */
export async function toUIMessages(rows: StoredMessage[]): Promise<AssistantUIMessage[]> {
  const declaredByRow = rows.map((row) => (row.role === "assistant" ? storedBlocks(row) : []));
  const hydratedByRow = await hydrateBlockGroups(declaredByRow);
  return rows.map((row, index): AssistantUIMessage => {
    const createdAt = row.created_at.toISOString();
    if (row.role !== "assistant") {
      return {
        id: row.id,
        role: "user",
        metadata: { kind: row.role === "action" ? "action" : undefined, createdAt },
        parts: [{ type: "text", text: row.content }],
      };
    }
    const declared = declaredByRow[index];
    const parts: AssistantUIMessage["parts"] = [];
    if (declared.length) {
      parts.push({
        type: "tool-show_blocks",
        toolCallId: `history-${row.id}`,
        state: "output-available",
        input: { blocks: declared },
        output: { blocks: hydratedByRow[index], declared, dropped: 0, strippedJyutping: 0 },
      } as AssistantUIMessage["parts"][number]);
    }
    if (row.content) parts.push({ type: "text", text: row.content });
    return { id: row.id, role: "assistant", metadata: { createdAt }, parts };
  });
}
