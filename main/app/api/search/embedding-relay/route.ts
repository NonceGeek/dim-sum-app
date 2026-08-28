import { NextRequest, NextResponse } from "next/server";
import { getDirectQueryEmbeddingText } from "@/lib/search/query-embedding";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const preferredRegion = "iad1";

async function secretsMatch(
  received: string | null,
  expected: string,
): Promise<boolean> {
  if (!received) return false;
  const encoder = new TextEncoder();
  const receivedValue = encoder.encode(received);
  const expectedValue = encoder.encode(expected);
  const [receivedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", receivedValue),
    crypto.subtle.digest("SHA-256", expectedValue),
  ]);
  const receivedBytes = new Uint8Array(receivedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= receivedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0 && receivedValue.length === expectedValue.length;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEARCH_EMBEDDING_RELAY_SECRET?.trim();
  if (
    !secret ||
    !(await secretsMatch(
      request.headers.get("x-embedding-relay-token"),
      secret,
    ))
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as {
    query?: unknown;
  } | null;
  const query = typeof input?.query === "string" ? input.query.trim() : "";
  if (!query || query.length > 200) {
    return NextResponse.json({ message: "Invalid query" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const embedding = await getDirectQueryEmbeddingText(query);
    if (!embedding) {
      return NextResponse.json(
        { message: "Embedding unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        embedding,
        model: "qwen3-vl-embedding",
        dimension: 1024,
        elapsedMs: Date.now() - startedAt,
        region: process.env.VERCEL_REGION || "unknown",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Search embedding relay failed", {
      region: process.env.VERCEL_REGION || "unknown",
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { message: "Embedding relay temporarily unavailable" },
      { status: 502 },
    );
  }
}
