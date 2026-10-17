import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// 有新加坡地域 key 时走 DashScope 国际站（与 sin1 同区域，连接稳定）；否则退回北京。
// key 按地域绑定，北京 key 不能用于国际站接口，反之亦然。
const BEIJING_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const INTL_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";

export function getAssistantModelId(): string {
  return process.env.ASSISTANT_MODEL?.trim() || DEFAULT_MODEL;
}

function resolveEndpoint(): { apiKey: string; baseURL: string } | null {
  const override = process.env.DASHSCOPE_COMPATIBLE_BASE_URL?.trim();
  const intlKey = process.env.DASHSCOPE_INTL_API_KEY?.trim();
  if (intlKey) return { apiKey: intlKey, baseURL: override || INTL_BASE_URL };
  const beijingKey =
    process.env.DASHSCOPE_API_KEY || process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY;
  if (beijingKey) return { apiKey: beijingKey, baseURL: override || BEIJING_BASE_URL };
  return null;
}

export function getAssistantModel() {
  const endpoint = resolveEndpoint();
  if (!endpoint) throw new Error("DashScope API key is missing");
  const provider = createOpenAICompatible({
    name: "dashscope",
    baseURL: endpoint.baseURL,
    apiKey: endpoint.apiKey,
    includeUsage: true,
  });
  return provider.chatModel(getAssistantModelId());
}
