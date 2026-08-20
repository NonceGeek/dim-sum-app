import { NextRequest, NextResponse } from "next/server";
import { requireCorpusCollectionAccess } from "@/lib/services/corpus-collection-access";
import { getActivityComparison, getQuestionnaireOverview, parseInsightsFilters } from "@/lib/services/questionnaire-insights";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireCorpusCollectionAccess(req, async (_req, access) => {
    try {
      const filters = parseInsightsFilters(req.nextUrl, access);
      const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 5);
      const limit = Number.isFinite(rawLimit) ? Math.min(10, Math.max(1, Math.floor(rawLimit))) : 5;
      const detail = getActivityComparison(await getQuestionnaireOverview(access, filters), limit);
      await prisma.corpus_collection_audit_logs.create({
        data: {
          operator_id: access.userId,
          action: "questionnaire.insights.drilldown",
          activity_id: filters.activityId,
          filters: { detail: "activity_comparison", limit },
          result_summary: { activityCount: detail.summary.activityCount },
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
