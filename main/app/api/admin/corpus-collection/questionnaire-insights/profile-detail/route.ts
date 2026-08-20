import { NextRequest, NextResponse } from "next/server";
import { requireCorpusCollectionAccess } from "@/lib/services/corpus-collection-access";
import { getProfileDetail, getQuestionnaireOverview, parseInsightsFilters } from "@/lib/services/questionnaire-insights";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireCorpusCollectionAccess(req, async (_req, access) => {
    try {
      const dimension = req.nextUrl.searchParams.get("dimension");
      if (!dimension || !["age", "region", "interest"].includes(dimension)) {
        return NextResponse.json({ error: "INVALID_DIMENSION" }, { status: 400 });
      }
      const filters = parseInsightsFilters(req.nextUrl, access);
      const detail = getProfileDetail(
        await getQuestionnaireOverview(access, filters),
        dimension as "age" | "region" | "interest",
      );
      await prisma.corpus_collection_audit_logs.create({
        data: {
          operator_id: access.userId,
          action: "questionnaire.insights.drilldown",
          activity_id: filters.activityId,
          filters: { detail: "profile", dimension },
          result_summary: { sampleSize: detail.sampleSize },
        },
      });
      return NextResponse.json(detail);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      return NextResponse.json(
        { error: message },
        { status: message === "ACTIVITY_ACCESS_DENIED" ? 403 : message.startsWith("INVALID_") ? 400 : 500 },
      );
    }
  });
}
