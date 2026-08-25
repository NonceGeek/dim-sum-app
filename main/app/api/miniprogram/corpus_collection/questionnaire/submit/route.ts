import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  completeQuestionnaireJourney,
  recordQuestionnairePhoneSubmitFailure,
} from "@/lib/services/questionnaire-journey";
import { bindQuestionnairePhone } from "@/lib/services/questionnaire-phone-binding";
import { QuestionnaireAnswers, questionnaireErrorResponse, submitQuestionnaireRequestSchema } from "@/lib/services/questionnaire-schema";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = submitQuestionnaireRequestSchema.parse(await req.json()) as {
        journeyId: string;
        schemaVersion?: number;
        answers?: QuestionnaireAnswers;
        phoneBinding?: {
          phoneNumber: string;
          verificationCode: string;
          confirmMerge: boolean;
        };
      };
      if (input.phoneBinding) {
        try {
          await bindQuestionnairePhone(user.userId, {
            journeyId: input.journeyId,
            ...input.phoneBinding,
          });
        } catch (error) {
          try {
            await recordQuestionnairePhoneSubmitFailure(user.userId, input.journeyId, error);
          } catch (eventError) {
            console.error("[Questionnaire] Failed to record phone_submit_fail", eventError);
          }
          throw error;
        }
      }
      return NextResponse.json(await completeQuestionnaireJourney(user.userId, {
        journeyId: input.journeyId,
        schemaVersion: input.schemaVersion,
        answers: input.answers,
      }));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
