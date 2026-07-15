import { NextRequest, NextResponse } from "next/server";
import { getOptionalMiniprogramUser } from "@/lib/miniprogram-auth";
import {
  listHomeFeedSubmissions,
  parseBigIntId,
  parsePositiveInt,
} from "@/lib/services/corpus-collection";

function parseOptionalBoolean(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseFeedSort(value: string | null) {
  if (value === "likes" || value === "views") return value;
  return "latest";
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 30);
  const sort = parseFeedSort(searchParams.get("sort"));
  const type = searchParams.get("type") ?? searchParams.get("submissionType");
  const tag = searchParams.get("tag");
  const activityId = parseBigIntId(searchParams.get("activityId"));
  const featured = parseOptionalBoolean(searchParams.get("isFeatured"));
  const showOnHome = parseOptionalBoolean(searchParams.get("showOnHome"));

  const user = await getOptionalMiniprogramUser(req);
  try {
    return NextResponse.json(
      await listHomeFeedSubmissions({
        activityId,
        featured,
        showOnHome,
        type,
        tag,
        page,
        pageSize,
        sort,
        viewerId: user?.userId,
      })
    );
  } catch (error) {
    console.error("[CorpusCollection] Failed to load home submissions", error);
    return NextResponse.json(
      { error: "Failed to load home submissions" },
      { status: 500 }
    );
  }
}
