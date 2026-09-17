import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { CorpusEditAccessError, EDITOR_CACHE_HEADERS, getCorpusItemForEditing } from "@/lib/services/corpus-edit-access";

export async function GET(_req: NextRequest, context: AppRouteContext) {
  try {
    const session = await getAuthSession();
    const uuid = await getStringRouteParam(context, "uuid");
    const item = await getCorpusItemForEditing(session?.user?.id, uuid ?? "");
    const { cantonese_categories: dataset, ...corpus } = item;
    const payload = {
      ...corpus,
      category_name: item.category,
      category_display_name: dataset.nickname || item.category,
      editable_level: dataset.editable_level,
    };
    return NextResponse.json(JSON.parse(JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )), { headers: EDITOR_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof CorpusEditAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: EDITOR_CACHE_HEADERS });
    }
    console.error("Error reading corpus for editing:", error);
    return NextResponse.json({ error: "Failed to load corpus item" }, { status: 500, headers: EDITOR_CACHE_HEADERS });
  }
}
