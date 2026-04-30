import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeCategory(category: any) {
  return {
    id: category.id.toString(),
    name: category.name,
    type: category.type,
    status: category.status,
    sortOrder: category.sort_order,
  };
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type");
  const status = searchParams.get("status") || undefined;

  return requireAdmin(req, async () => {
    const items = await prisma.corpus_collection_categories.findMany({
      where: { type: type || undefined, status },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
    return NextResponse.json({ items: items.map(serializeCategory) });
  });
}

export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const category = await prisma.corpus_collection_categories.create({
      data: {
        name: body.name,
        type: body.type || "tag",
        status: body.status || "active",
        sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      },
    });
    return NextResponse.json(serializeCategory(category), { status: 201 });
  });
}
