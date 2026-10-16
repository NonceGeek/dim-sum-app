import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { assertCategoryTagCreator } from "@/lib/taxonomy/common";
import { createTag, listTags, parseTagInput } from "@/lib/taxonomy/tags";
import { embedTag } from "@/lib/taxonomy/tag-embeddings";
import { appErrorResponse } from "@/lib/app-error";

export const runtime = "nodejs";

// Best effort; the daily /api/cron/tag-embeddings sweep retries anything missed here.
function scheduleTagEmbedding(tagId: string) {
  const logFailure = (error: unknown) => console.error("Tag embedding after create failed", { tagId, error });
  try {
    after(() => embedTag(prisma, BigInt(tagId)).catch(logFailure));
  } catch (error) {
    logFailure(error);
  }
}

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const items = await listTags(prisma, req.nextUrl.searchParams.get("q") ?? "");
      return NextResponse.json({ items });
    } catch (error) {
      return appErrorResponse(error, "Miniprogram category/tag request failed");
    }
  });
}

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      await assertCategoryTagCreator(prisma, user.userId);
      const input = parseTagInput(await req.json().catch(() => null));
      const result = await createTag(prisma, input, user.userId);
      if (result.created) scheduleTagEmbedding(result.item.id);
      return NextResponse.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      return appErrorResponse(error, "Miniprogram category/tag request failed");
    }
  });
}
