const DASHSCOPE_EMBEDDING_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding";

type DashScopeEmbeddingResponse = {
  output?: {
    embeddings?: Array<{
      embedding?: number[];
    }>;
  };
  message?: string;
  code?: string;
};

const queryEmbeddingCache = new Map<string, Promise<string>>();

function getDashScopeApiKey(): string | null {
  return (
    process.env.DASHSCOPE_API_KEY ||
    process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY ||
    null
  );
}

function normalizeQueryForEmbedding(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export async function getQueryEmbeddingText(query: string): Promise<string | null> {
  const normalizedQuery = normalizeQueryForEmbedding(query);
  if (!normalizedQuery) return null;

  const cached = queryEmbeddingCache.get(normalizedQuery);
  if (cached) return cached;

  const apiKey = getDashScopeApiKey();
  if (!apiKey) return null;

  const request = fetch(DASHSCOPE_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen3-vl-embedding",
      input: {
        contents: [{ text: normalizedQuery }],
      },
      parameters: {
        dimension: 1024,
        enable_fusion: false,
      },
    }),
  })
    .then(async (response) => {
      const payload = (await response.json()) as DashScopeEmbeddingResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            payload.code ||
            `DashScope embedding request failed: ${response.status}`,
        );
      }

      const embedding = payload.output?.embeddings?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length !== 1024) {
        throw new Error("DashScope embedding response missing 1024-d vector");
      }

      return `[${embedding.join(",")}]`;
    })
    .catch((error) => {
      queryEmbeddingCache.delete(normalizedQuery);
      throw error;
    });

  queryEmbeddingCache.set(normalizedQuery, request);
  return request;
}
