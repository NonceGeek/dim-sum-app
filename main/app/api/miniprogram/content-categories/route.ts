import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { assertCategoryTagCreator } from "@/lib/taxonomy/common";
import { createContentCategory, listContentCategories, parseCategoryInput, parseParentId } from "@/lib/taxonomy/content-categories";
import { appErrorResponse, readJsonBody } from "@/lib/app-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const parentId = req.nextUrl.searchParams.get("parentId");
      const items = await listContentCategories(prisma, parentId === null ? null : parseParentId(parentId));
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
      const input = parseCategoryInput(await readJsonBody(req));
      const result = await createContentCategory(prisma, input);
      return NextResponse.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      return appErrorResponse(error, "Miniprogram category/tag request failed");
    }
  });
}
