import { NextRequest, NextResponse } from "next/server";
import { requireCorpusCollectionAccess } from "@/lib/services/corpus-collection-access";

export async function GET(req: NextRequest) {
  return requireCorpusCollectionAccess(req, async (_req, access) =>
    NextResponse.json({
      allowed: true,
      isSystemAdmin: access.isSystemAdmin,
      canExport: access.canExport,
      activityIds: access.activityIds?.map(String) ?? null,
    }),
  );
}
