import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { AccessError } from "@/lib/services/submission-access";
import { contributionApplicationSchema } from "@/lib/library/options";
import { createContributionApplication } from "@/lib/library/contribution-service";
import { clientIpHash } from "@/lib/library/submission-guard";

/** Contribution intake: metadata only, never raw corpus files. */
export async function POST(req: NextRequest) {
  try {
    const parsed = contributionApplicationSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "请完整填写必填项", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    // Honeypot filled: answer like a success without storing anything.
    if (parsed.data.website)
      return NextResponse.json(
        { applicationNo: null, status: "PENDING_INITIAL_REVIEW" },
        { status: 201 },
      );
    const session = await getAuthSession().catch(() => null);
    const application = await createContributionApplication(parsed.data, {
      ipHash: clientIpHash(req),
      userId: session?.user?.id ?? null,
    });
    return NextResponse.json(
      { applicationNo: application.application_no, status: application.status },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Contribution application failed", error);
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 });
  }
}
