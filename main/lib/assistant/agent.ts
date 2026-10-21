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

type TimedStep = {
  toolCalls: { toolName: string }[];
  usage: { outputTokens?: number; inputTokens?: number };
  performance: { stepTimeMs: number; responseTimeMs: number; toolExecutionMs: Readonly<Record<string, number>> };
};

/** 每一步的耗时摘要：模型响应、工具执行、输出 token，用于定位慢在哪一步。 */
export function summarizeSteps(steps: readonly TimedStep[]) {
  const perStep = steps.map((step, index) => ({
    step: index + 1,
    tools: step.toolCalls.map((call) => call.toolName),
    stepMs: Math.round(step.performance.stepTimeMs),
    modelMs: Math.round(step.performance.responseTimeMs),
    toolMs: Math.round(Object.values(step.performance.toolExecutionMs).reduce((a, b) => a + b, 0)),
    outTokens: step.usage.outputTokens ?? null,
  }));
  return {
    totalMs: perStep.reduce((sum, step) => sum + step.stepMs, 0),
    steps: perStep,
  };
}
