import { NextRequest, NextResponse } from "next/server";
import { AccessError } from "@/lib/services/submission-access";
import { datasetContactRequestSchema } from "@/lib/library/options";
import { createDatasetContactRequest } from "@/lib/library/contribution-service";
import { clientIpHash } from "@/lib/library/submission-guard";

export async function POST(req: NextRequest) {
  try {
    const parsed = datasetContactRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json({ error: "请完整填写必填项" }, { status: 400 });
    if (parsed.data.website)
      return NextResponse.json({ success: true }, { status: 201 });
    await createDatasetContactRequest(parsed.data, clientIpHash(req));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Dataset contact request failed", error);
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
