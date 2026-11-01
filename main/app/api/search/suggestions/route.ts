import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { parseDatasets } from "@/lib/search/entry-search";
import { fetchSearchSuggestions } from "@/lib/search/suggestions";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length > 200) {
    return NextResponse.json({ error: "Query exceeds 200 characters" }, { status: 400, headers });
  }
  if (!query) return NextResponse.json({ suggestions: [] }, { headers });
  try {
    const suggestions = await fetchSearchSuggestions(query, parseDatasets(req.nextUrl.searchParams.get("dataset")));
    return NextResponse.json({ suggestions }, { headers });
  } catch (error) {
    console.error("Public search suggestions failed:", error);
    const response = databaseErrorResponse(error, "Search suggestions failed");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
