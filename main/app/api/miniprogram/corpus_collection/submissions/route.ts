import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  createCorpusSubmission,
  serializeSubmission,
} from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const submission = await createCorpusSubmission(user.userId, await req.json());

      return NextResponse.json(
        {
          id: submission.id.toString(),
          reviewStatus: submission.review_status,
          message: "投稿已提交，等待审核",
          submission: serializeSubmission(submission),
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create submission";
      const status = message === "Invalid media requirements" ? 422 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
