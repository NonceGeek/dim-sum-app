import { isStepCount, streamText, type ModelMessage, type StreamTextOnEndCallback } from "ai";
import type { Grounding } from "./blocks";
import { getAssistantModel } from "./model";
import { ASSISTANT_INSTRUCTIONS } from "./prompt";
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
    prepareStep: ({ steps, stepNumber }) => {
      const shown = steps.some((step) =>
        step.toolCalls.some((call) => call.toolName === "show_blocks"),
      );
      if (shown) return { toolChoice: "none" };
      const usedTools = steps.some((step) => step.toolCalls.length > 0);
      if (usedTools && stepNumber >= FORCE_SHOW_BLOCKS_STEP) {
        return { toolChoice: { type: "tool", toolName: "show_blocks" } };
      }
      return {};
    },
    experimental_transform: stripJyutpingTransform<AssistantTools>(),
    onEnd: params.onEnd,
  });
  return { result, tools };
}
