import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// DashScope 的 OpenAI 兼容接口；国际站可通过 DASHSCOPE_COMPATIBLE_BASE_URL 切换
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";

export function getAssistantModelId(): string {
  return process.env.ASSISTANT_MODEL?.trim() || DEFAULT_MODEL;
}

export function getAssistantModel() {
  const apiKey =
    process.env.DASHSCOPE_API_KEY || process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("DashScope API key is missing");
  const provider = createOpenAICompatible({
    name: "dashscope",
    baseURL: process.env.DASHSCOPE_COMPATIBLE_BASE_URL?.trim() || DEFAULT_BASE_URL,
    apiKey,
    includeUsage: true,
  });
  return provider.chatModel(getAssistantModelId());
}
