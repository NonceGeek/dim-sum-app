import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { createQuestionnaireJourney } from "@/lib/services/questionnaire-journey";
import { entryRequestSchema, questionnaireErrorResponse } from "@/lib/services/questionnaire-schema";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = entryRequestSchema.parse(await req.json()) as {
        activityId?: string;
        clientEventId: string;
      };
      return NextResponse.json(await createQuestionnaireJourney(user.userId, input));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
