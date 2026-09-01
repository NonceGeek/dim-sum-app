import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getNextCategorySortOrder,
  isCorpusCollectionCategoryType,
  parseCategoryOrder,
  serializeCorpusCollectionCategory,
} from "@/lib/corpus-collection-category";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type");
  const status = searchParams.get("status") || undefined;

  return requireAdmin(req, async () => {
    const items = await prisma.corpus_collection_categories.findMany({
      where: { type: type || undefined, status },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    });
    return NextResponse.json({ items: items.map(serializeCorpusCollectionCategory) });
  });
}

export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type ?? "tag";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!isCorpusCollectionCategoryType(type)) {
      return NextResponse.json({ error: "invalid category type" }, { status: 400 });
    }

    const category = await prisma.$transaction(async (tx) => {
      const currentMaximum = await tx.corpus_collection_categories.aggregate({
        where: { type },
        _max: { sort_order: true },
      });
      return tx.corpus_collection_categories.create({
        data: {
          name,
          type,
          status: body.status || "active",
          sort_order: getNextCategorySortOrder(currentMaximum._max.sort_order),
        },
      });
    });
    return NextResponse.json(serializeCorpusCollectionCategory(category), { status: 201 });
  });
}

export async function PATCH(req: NextRequest) {
  return requireAdmin(req, async () => {
    let orderedIds: bigint[];
    try {
      orderedIds = parseCategoryOrder((await req.json()).orderedIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid category order";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const existingCount = await prisma.corpus_collection_categories.count({
      where: { id: { in: orderedIds } },
    });
    if (existingCount !== orderedIds.length) {
      return NextResponse.json({ error: "one or more categories do not exist" }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        prisma.corpus_collection_categories.update({
          where: { id },
          data: { sort_order: sortOrder },
        }),
      ),
    );
    return NextResponse.json({ success: true });
  });
}
