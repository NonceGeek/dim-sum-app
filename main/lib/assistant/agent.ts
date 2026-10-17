import { isStepCount, streamText, type ModelMessage, type StreamTextOnEndCallback } from "ai";
import type { Grounding } from "./blocks";
import { getAssistantModel } from "./model";
import { ASSISTANT_INSTRUCTIONS } from "./prompt";
import { balanceJson } from "./repair";
import { stripJyutpingTransform } from "./stream";
import { createAssistantTools, type AssistantTools, type ToolTraceItem } from "./tools";

export const MAX_STEPS = 6;
// 到这一步还没展示组件时强制调用 show_blocks，留最后一步收尾
const FORCE_SHOW_BLOCKS_STEP = MAX_STEPS - 2;

export function streamAssistant(params: {
  messages: ModelMessage[];
  grounding: Grounding;
  trace: ToolTraceItem[];
  onEnd?: StreamTextOnEndCallback<AssistantTools>;
}) {
  const tools = createAssistantTools(params.grounding, params.trace);
  const result = streamText({
    model: getAssistantModel(),
    instructions: ASSISTANT_INSTRUCTIONS,
    messages: params.messages,
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    // 工具串行执行：多个检索并发会抢占数据库连接池（每实例 3 个连接），导致 P2028
    toolCallConcurrency: 1,
    prepareStep: ({ steps, stepNumber }) => {
      // 只有成功执行的 show_blocks 才算已展示；参数无效时允许重试
      const shown = steps.some((step) =>
        step.toolResults.some((result) => result.toolName === "show_blocks"),
      );
      if (shown) return { toolChoice: "none" };
      const usedTools = steps.some((step) => step.toolCalls.length > 0);
      if (usedTools && stepNumber >= FORCE_SHOW_BLOCKS_STEP) {
        return { toolChoice: { type: "tool", toolName: "show_blocks" } };
      }
      return {};
    },
    repairToolCall: async ({ toolCall }) => {
      const input = balanceJson(toolCall.input);
      return input ? { ...toolCall, input } : null;
    },
    experimental_transform: stripJyutpingTransform<AssistantTools>(),
    onEnd: params.onEnd,
  });
  return { result, tools };
}
