import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AccessError } from "@/lib/services/submission-access";
import { processReviewEvent, reviewEventSchema } from "@/lib/services/submission-review-event";
export async function POST(req: NextRequest) {
  const token = process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN;
  const expected = Buffer.from(`Bearer ${token ?? ""}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = reviewEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const payload = parsed.data;
  if ((!payload.batchExternalId && !payload.batchId) || (payload.event === "submission.reviewed" && (!payload.submissionExternalId || !payload.result))) return NextResponse.json({ error: "Missing batch or submission" }, { status: 400 });
  const eventId = req.headers.get("x-event-id") || `${payload.batchExternalId ?? payload.batchId}:${payload.event}:${payload.submissionExternalId ?? "finished"}`;
  try {
    await processReviewEvent(payload, eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("AI callback failed", error);
    return NextResponse.json({ error: "Callback failed" }, { status: 500 });
  }
}
