import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { completeQuestionnaireJourney } from "@/lib/services/questionnaire-journey";
import { bindQuestionnairePhone } from "@/lib/services/questionnaire-phone-binding";
import { questionnaireErrorResponse, submitQuestionnaireRequestSchema } from "@/lib/services/questionnaire-schema";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = submitQuestionnaireRequestSchema.parse(await req.json()) as {
        journeyId: string;
        schemaVersion?: 1;
        answers?: {
          ageRange: "under_18" | "age_18_24" | "age_25_34" | "age_35_44" | "age_45_plus";
          cultureRegion: "guangzhou" | "foshan" | "jiangmen" | "hong_kong" | "macao" | "zhuhai" | "shunde" | "overseas_cantonese";
          interestTypes: Array<"language_usage" | "story" | "poetry" | "place_name_explanation" | "proverb" | "natural_conversation" | "cantonese_film_tv" | "cantonese_dubbed_animation" | "other">;
        };
        phoneBinding?: {
          phoneNumber: string;
          verificationCode: string;
          confirmMerge: boolean;
        };
      };
      if (input.phoneBinding) {
        await bindQuestionnairePhone(user.userId, {
          journeyId: input.journeyId,
          ...input.phoneBinding,
        });
      }
      return NextResponse.json(await completeQuestionnaireJourney(user.userId, {
        journeyId: input.journeyId,
        answers: input.answers,
      }));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
