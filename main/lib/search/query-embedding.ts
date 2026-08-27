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

const QUERY_EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_EMBEDDING_CACHE_MAX_ENTRIES = 256;
const QUERY_EMBEDDING_TIMEOUT_MS = 4_000;
const queryEmbeddingCache = new Map<
  string,
  { value: Promise<string>; expiresAt: number }
>();

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
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) queryEmbeddingCache.delete(normalizedQuery);

  const apiKey = getDashScopeApiKey();
  if (!apiKey) return null;

  const request = fetch(DASHSCOPE_EMBEDDING_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(QUERY_EMBEDDING_TIMEOUT_MS),
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

  if (queryEmbeddingCache.size >= QUERY_EMBEDDING_CACHE_MAX_ENTRIES) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (oldestKey) queryEmbeddingCache.delete(oldestKey);
  }
  queryEmbeddingCache.set(normalizedQuery, {
    value: request,
    expiresAt: Date.now() + QUERY_EMBEDDING_CACHE_TTL_MS,
  });
  return request;
}
