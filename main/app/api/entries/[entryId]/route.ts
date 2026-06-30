import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { publicApi } from "@/lib/auth";
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest, context: AppRouteContext) {
  const response = await publicApi(req, async () => {
    const entryId = await getStringRouteParam(context, "entryId");

    if (!entryId || !UUID_PATTERN.test(entryId)) {
      return jsonWithCors(
        { error: "Invalid entry id", code: "INVALID_ENTRY_ID" },
        { status: 400 },
      );
    }

    const entry = await fetchEntryIdentityByUniqueId(entryId);

    if (!entry) {
      return jsonWithCors(
        { error: "Entry not found", code: "ENTRY_NOT_FOUND" },
        { status: 404 },
      );
    }

    return jsonWithCors({ entry });
  });

  return withCors(response);
}
