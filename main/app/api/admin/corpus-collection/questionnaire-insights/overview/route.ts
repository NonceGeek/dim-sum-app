import { NextRequest, NextResponse } from "next/server";
import { requireCorpusCollectionAccess } from "@/lib/services/corpus-collection-access";
import { getQuestionnaireOverview, parseInsightsFilters } from "@/lib/services/questionnaire-insights";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireCorpusCollectionAccess(req, async (_req, access) => {
    try {
      const filters = parseInsightsFilters(req.nextUrl, access);
      const result = await getQuestionnaireOverview(access, filters);
      await prisma.corpus_collection_audit_logs.create({
        data: {
          operator_id: access.userId,
          action: "questionnaire.insights.view",
          activity_id: filters.activityId,
          filters: result.filters,
          result_summary: { activityCount: result.activities.length },
        },
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      if (message === "ACTIVITY_ACCESS_DENIED") {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message === "INVALID_DATE_RANGE" || message === "INVALID_FILTER") {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error("[QuestionnaireInsights] overview failed", error);
      return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
  });
}
