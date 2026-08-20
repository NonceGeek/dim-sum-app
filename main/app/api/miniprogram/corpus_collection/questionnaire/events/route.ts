import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { recordQuestionnaireClientEvent } from "@/lib/services/questionnaire-journey";
import { clientEventRequestSchema, questionnaireErrorResponse } from "@/lib/services/questionnaire-schema";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = clientEventRequestSchema.parse(await req.json()) as {
        journeyId: string;
        clientEventId: string;
        eventName: "open_questionnaire" | "continue_questionnaire" | "cancel_questionnaire";
      };
      return NextResponse.json(await recordQuestionnaireClientEvent(user.userId, input));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
