import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { listContentCategoryTree } from "@/lib/taxonomy/content-categories";
import { appErrorResponse } from "@/lib/app-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const items = await listContentCategoryTree(prisma);
      return NextResponse.json({ items });
    } catch (error) {
      return appErrorResponse(error, "Miniprogram category/tag request failed");
    }
  });
}
