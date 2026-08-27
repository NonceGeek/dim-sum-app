const DASHSCOPE_EMBEDDING_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding";
const EMBEDDING_RELAY_PATH = "/api/search/embedding-relay";
const EMBEDDING_MODEL = "qwen3-vl-embedding";
const EMBEDDING_DIMENSION = 1024;

type DashScopeEmbeddingResponse = {
  output?: { embeddings?: Array<{ embedding?: number[] }> };
  message?: string;
  code?: string;
};

type EmbeddingRelayResponse = {
  embedding?: string;
  message?: string;
};

const QUERY_EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_EMBEDDING_CACHE_MAX_ENTRIES = 256;
const QUERY_EMBEDDING_TIMEOUT_MS = 4_000;
const QUERY_EMBEDDING_RELAY_TIMEOUT_MS = 6_000;
const queryEmbeddingCache = new Map<
  string,
  { value: Promise<string>; expiresAt: number }
>();

function positiveIntegerFromEnvironment(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDashScopeApiKey(): string | null {
  return (
    process.env.DASHSCOPE_API_KEY ||
    process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY ||
    null
  );
}

function getRelayConfiguration(): { url: string; secret: string } | null {
  const secret = process.env.SEARCH_EMBEDDING_RELAY_SECRET?.trim();
  const explicitUrl = process.env.SEARCH_EMBEDDING_RELAY_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const url =
    explicitUrl ||
    (vercelUrl ? `https://${vercelUrl}${EMBEDDING_RELAY_PATH}` : "");

  if (!secret && !explicitUrl && !vercelUrl) return null;
  if (!secret || !url) {
    throw new Error("Search embedding relay configuration is incomplete");
  }
  return { url, secret };
}

function normalizeQueryForEmbedding(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function validateEmbeddingText(embedding: unknown): string {
  if (typeof embedding !== "string") {
    throw new Error("Embedding response is missing vector text");
  }
  const dimension = embedding === "[]" ? 0 : embedding.split(",").length;
  if (
    !embedding.startsWith("[") ||
    !embedding.endsWith("]") ||
    dimension !== EMBEDDING_DIMENSION
  ) {
    throw new Error(`Embedding response missing ${EMBEDDING_DIMENSION}-d vector`);
  }
  return embedding;
}

function cachedEmbeddingRequest(
  cacheKey: string,
  requestFactory: () => Promise<string>,
): Promise<string> {
  const cached = queryEmbeddingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) queryEmbeddingCache.delete(cacheKey);

  const request = requestFactory().catch((error) => {
    queryEmbeddingCache.delete(cacheKey);
    throw error;
  });

  if (queryEmbeddingCache.size >= QUERY_EMBEDDING_CACHE_MAX_ENTRIES) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (oldestKey) queryEmbeddingCache.delete(oldestKey);
  }
  queryEmbeddingCache.set(cacheKey, {
    value: request,
    expiresAt: Date.now() + QUERY_EMBEDDING_CACHE_TTL_MS,
  });
  return request;
}

async function requestDirectEmbedding(normalizedQuery: string): Promise<string> {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) throw new Error("DashScope API key is missing");

  const response = await fetch(DASHSCOPE_EMBEDDING_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(QUERY_EMBEDDING_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: { contents: [{ text: normalizedQuery }] },
      parameters: {
        dimension: EMBEDDING_DIMENSION,
        enable_fusion: false,
      },
    }),
  });
  const payload = (await response.json()) as DashScopeEmbeddingResponse;
  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.code ||
        `DashScope embedding request failed: ${response.status}`,
    );
  }

  const embedding = payload.output?.embeddings?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `DashScope embedding response missing ${EMBEDDING_DIMENSION}-d vector`,
    );
  }
  return `[${embedding.join(",")}]`;
}

async function requestRelayEmbedding(
  normalizedQuery: string,
  relay: { url: string; secret: string },
): Promise<string> {
  const response = await fetch(relay.url, {
    method: "POST",
    signal: AbortSignal.timeout(
      positiveIntegerFromEnvironment(
        process.env.SEARCH_EMBEDDING_RELAY_TIMEOUT_MS,
        QUERY_EMBEDDING_RELAY_TIMEOUT_MS,
      ),
    ),
    headers: {
      "Content-Type": "application/json",
      "x-embedding-relay-token": relay.secret,
    },
    body: JSON.stringify({ query: normalizedQuery }),
  });
  const payload = (await response.json()) as EmbeddingRelayResponse;
  if (!response.ok) {
    throw new Error(
      payload.message || `Search embedding relay failed: ${response.status}`,
    );
  }
  return validateEmbeddingText(payload.embedding);
}

export async function getDirectQueryEmbeddingText(
  query: string,
): Promise<string | null> {
  const normalizedQuery = normalizeQueryForEmbedding(query);
  if (!normalizedQuery) return null;
  return cachedEmbeddingRequest(`direct:${normalizedQuery}`, () =>
    requestDirectEmbedding(normalizedQuery),
  );
}

export async function getQueryEmbeddingText(
  query: string,
): Promise<string | null> {
  const normalizedQuery = normalizeQueryForEmbedding(query);
  if (!normalizedQuery) return null;

  const relay = getRelayConfiguration();
  if (!relay) return getDirectQueryEmbeddingText(normalizedQuery);
  return cachedEmbeddingRequest(`relay:${normalizedQuery}`, () =>
    requestRelayEmbedding(normalizedQuery, relay),
  );
}
