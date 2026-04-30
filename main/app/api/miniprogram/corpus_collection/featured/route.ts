import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  listPublicSubmissions,
  parsePositiveInt,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);
  const type = searchParams.get("type");

  return requireMiniprogramAuth(req, async () => {
    return NextResponse.json(
      await listPublicSubmissions({
        page,
        pageSize,
        type,
        featured: true,
      })
    );
  });
}
