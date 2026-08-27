import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDirectQueryEmbeddingText } from "@/lib/search/query-embedding";

export const dynamic = "force-dynamic";

function secretsMatch(received: string | null, expected: string): boolean {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEARCH_EMBEDDING_RELAY_SECRET?.trim();
  if (
    !secret ||
    !secretsMatch(request.headers.get("x-embedding-relay-token"), secret)
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const input = (await request.json()) as { query?: unknown };
  const query = typeof input.query === "string" ? input.query.trim() : "";
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
