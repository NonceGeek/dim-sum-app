import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { assertCategoryTagCreator } from "@/lib/taxonomy/common";
import { createTag, listTags, parseTagInput } from "@/lib/taxonomy/tags";
import { appErrorResponse, readJsonBody } from "@/lib/app-error";

export const runtime = "nodejs";

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
      const input = parseTagInput(await readJsonBody(req));
      const result = await createTag(prisma, input);
      return NextResponse.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      return appErrorResponse(error, "Miniprogram category/tag request failed");
    }
  });
}
