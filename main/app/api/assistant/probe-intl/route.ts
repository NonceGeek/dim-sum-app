// 临时探针：验证新加坡（国际站）DashScope 的对话与 embedding，验证完删除。
// 只返回耗时、是否成功和向量相似度，不返回任何密钥。
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDPOINTS = {
  beijing: "https://dashscope.aliyuncs.com",
  intl: "https://dashscope-intl.aliyuncs.com",
};
const EMBEDDING_PATH = "/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding";
const QUERIES = [
  "饭堂", "咩", "乜嘢", "唔该", "多谢", "早晨", "食饭未", "点解", "边度", "几多钱",
  "饮茶", "落雨", "好攰", "冇问题", "收工", "埋单", "靓仔", "老豆", "搞掂", "粤语点讲",
];

async function timed<T>(run: () => Promise<T>) {
  const start = Date.now();
  try {
    return { ms: Date.now() - start, ok: true as const, value: await run(), done: Date.now() - start };
  } catch (error) {
    return { ms: Date.now() - start, ok: false as const, error: String(error).slice(0, 160) };
  }
}

async function embed(base: string, apiKey: string, text: string): Promise<number[]> {
  const response = await fetch(`${base}${EMBEDDING_PATH}`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3-vl-embedding",
      input: { contents: [{ text }] },
      parameters: { dimension: 1024, enable_fusion: false },
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload.code ?? ""} ${payload.message ?? ""}`);
  return payload.output.embeddings[0].embedding;
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
}

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    const intlKey = process.env.DASHSCOPE_INTL_API_KEY?.trim();
    const beijingKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (!intlKey || !beijingKey) {
      return NextResponse.json({ region: process.env.VERCEL_REGION, intlKey: Boolean(intlKey), beijingKey: Boolean(beijingKey) });
    }

    const chat = await timed(async () => {
      const response = await fetch(`${ENDPOINTS.intl}/compatible-mode/v1/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${intlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "qwen-plus", messages: [{ role: "user", content: "回复OK" }], max_tokens: 5 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`${response.status} ${payload.error?.code ?? ""} ${payload.error?.message ?? ""}`);
      return payload.model as string;
    });

    const similarities: { query: string; cosine?: number; error?: string }[] = [];
    const latency = { beijing: [] as number[], intl: [] as number[] };
    for (const query of QUERIES) {
      const bj = await timed(() => embed(ENDPOINTS.beijing, beijingKey, query));
      const sg = await timed(() => embed(ENDPOINTS.intl, intlKey, query));
      if (bj.ok) latency.beijing.push(bj.done);
      if (sg.ok) latency.intl.push(sg.done);
      if (bj.ok && sg.ok) {
        similarities.push({ query, cosine: Number(cosine(bj.value, sg.value).toFixed(6)) });
      } else {
        similarities.push({ query, error: (!bj.ok ? `beijing: ${bj.error}` : "") + (!sg.ok ? ` intl: ${sg.error}` : "") });
      }
    }
    const values = similarities.flatMap((s) => (s.cosine === undefined ? [] : [s.cosine]));
    const median = (list: number[]) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : null);

    return NextResponse.json({
      region: process.env.VERCEL_REGION,
      chat,
      embedding: {
        compared: values.length,
        minCosine: values.length ? Math.min(...values) : null,
        meanCosine: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(6)) : null,
        medianMs: { beijing: median(latency.beijing), intl: median(latency.intl) },
        similarities,
      },
    });
  });
}
