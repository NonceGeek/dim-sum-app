import assert from "node:assert/strict";
import test from "node:test";
import {
  getDirectQueryEmbeddingText,
  getQueryEmbeddingText,
} from "./query-embedding";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  SEARCH_EMBEDDING_RELAY_SECRET: process.env.SEARCH_EMBEDDING_RELAY_SECRET,
  SEARCH_EMBEDDING_RELAY_URL: process.env.SEARCH_EMBEDDING_RELAY_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("direct embedding uses qwen3-vl and returns 1024 dimensions", async () => {
  process.env.DASHSCOPE_API_KEY = "test-key";
  delete process.env.SEARCH_EMBEDDING_RELAY_SECRET;
  delete process.env.SEARCH_EMBEDDING_RELAY_URL;
  delete process.env.VERCEL_URL;
  let requestBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      output: { embeddings: [{ embedding: Array(1024).fill(0.25) }] },
    });
  };

  const embedding = await getDirectQueryEmbeddingText(
    "  粤语   文化 direct-test ",
  );
  assert.equal(embedding?.split(",").length, 1024);
  assert.equal(requestBody?.model, "qwen3-vl-embedding");
  assert.deepEqual(requestBody?.input, {
    contents: [{ text: "粤语 文化 direct-test" }],
  });
});

test("search embedding uses the authenticated relay when configured", async () => {
  process.env.SEARCH_EMBEDDING_RELAY_SECRET = "relay-secret";
  process.env.SEARCH_EMBEDDING_RELAY_URL =
    "https://relay.example/api/search/embedding-relay";
  let requestedUrl = "";
  let relayToken = "";

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    relayToken =
      new Headers(init?.headers).get("x-embedding-relay-token") || "";
    return Response.json({
      embedding: `[${Array(1024).fill(0.5).join(",")}]`,
    });
  };

  const embedding = await getQueryEmbeddingText("relay-test");
  assert.equal(embedding?.split(",").length, 1024);
  assert.equal(requestedUrl, process.env.SEARCH_EMBEDDING_RELAY_URL);
  assert.equal(relayToken, "relay-secret");
});

test("relay rejects vectors from an incompatible dimension", async () => {
  process.env.SEARCH_EMBEDDING_RELAY_SECRET = "relay-secret";
  process.env.SEARCH_EMBEDDING_RELAY_URL =
    "https://relay.example/api/search/embedding-relay";
  globalThis.fetch = async () =>
    Response.json({ embedding: `[${Array(16).fill(0.5).join(",")}]` });

  await assert.rejects(
    getQueryEmbeddingText("invalid-dimension-test"),
    /1024-d vector/,
  );
});

test("Vercel does not silently fall back to direct DashScope access", async () => {
  delete process.env.SEARCH_EMBEDDING_RELAY_SECRET;
  delete process.env.SEARCH_EMBEDDING_RELAY_URL;
  process.env.VERCEL_URL = "preview.example.vercel.app";

  await assert.rejects(
    getQueryEmbeddingText("missing-relay-secret-test"),
    /configuration is incomplete/,
  );
});
