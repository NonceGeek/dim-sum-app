import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { sendQuestionnairePhoneCode } from "@/lib/services/questionnaire-phone-binding";
import { questionnaireErrorResponse } from "@/lib/services/questionnaire-schema";

const requestSchema = z.object({
  journeyId: z.string().uuid(),
  phoneNumber: z.string(),
}).strict();

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const input = requestSchema.parse(await req.json()) as {
        journeyId: string;
        phoneNumber: string;
      };
      return NextResponse.json(await sendQuestionnairePhoneCode(user.userId, input));
    } catch (error) {
      const response = questionnaireErrorResponse(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  });
}
