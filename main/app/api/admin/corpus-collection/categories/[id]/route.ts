import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId } from "@/lib/services/corpus-collection";

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    const body = await req.json();
    const category = await prisma.corpus_collection_categories.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        status: body.status,
        sort_order: body.sortOrder,
      },
    });
    return NextResponse.json({
      id: category.id.toString(),
      name: category.name,
      type: category.type,
      status: category.status,
      sortOrder: category.sort_order,
    });
  });
}

export async function DELETE(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    await prisma.corpus_collection_categories.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
