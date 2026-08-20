import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { enterQuestionnaireSubmission } from "@/lib/services/questionnaire-journey";
import { enterSubmissionRequestSchema, questionnaireErrorResponse } from "@/lib/services/questionnaire-schema";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = enterSubmissionRequestSchema.parse(await req.json()) as {
        journeyId: string;
        clientEventId: string;
      };
      return NextResponse.json(await enterQuestionnaireSubmission(user.userId, input));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
