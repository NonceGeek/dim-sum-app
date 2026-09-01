import { NextRequest, NextResponse } from "next/server";
import {
  isCorpusCollectionCategoryType,
  serializeCorpusCollectionCategory,
} from "@/lib/corpus-collection-category";
import { prisma } from "@/lib/prisma";
import { PUBLIC_LIST_CACHE_HEADERS } from "@/lib/public-cache";

export async function GET(req: NextRequest) {
  const requestedType = new URL(req.url).searchParams.get("type");
  if (requestedType && !isCorpusCollectionCategoryType(requestedType)) {
    return NextResponse.json({ error: "invalid category type" }, { status: 400 });
  }

  const items = await prisma.corpus_collection_categories.findMany({
    where: {
      status: "active",
      type: requestedType || undefined,
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
  });

  return NextResponse.json(
    { items: items.map(serializeCorpusCollectionCategory) },
    { headers: PUBLIC_LIST_CACHE_HEADERS },
  );
}
