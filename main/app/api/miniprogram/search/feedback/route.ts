import { NextRequest, NextResponse } from "next/server";
import { feedbackInput, SearchError } from "@/lib/search-miniprogram/contracts";
import {
  feedbackUser,
  submitFeedback,
} from "@/lib/search-miniprogram/feedback";
import { failure, headers, readJson } from "@/lib/search-miniprogram/http";
export async function POST(req: NextRequest) {
  try {
    const result = feedbackInput.safeParse(await readJson(req));
    if (!result.success)
      throw new SearchError(
        400,
        "INVALID_FEEDBACK",
        "请检查反馈类型和内容（1–300 字）",
      );
    const userId = await feedbackUser(req);
    const { feedback, replayed } = await submitFeedback(result.data, userId);
    return NextResponse.json(
      {
        id: feedback.id,
        requestId: feedback.request_id,
        status: feedback.status,
        createdAt: feedback.created_at.toISOString(),
        replayed,
      },
      { status: replayed ? 200 : 201, headers },
    );
  } catch (error) {
    return failure(error);
  }
}
