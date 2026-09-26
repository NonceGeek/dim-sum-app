import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withSubmissionAccess,
  AccessError,
} from "@/lib/services/submission-access";
import {
  mutateSubmissions,
  submissionIdsSchema,
} from "@/lib/services/submission-mutations";
const schema = z
  .object({
    submissionIds: submissionIdsSchema,
    action: z.enum(["approve", "reject"]),
    reason: z.string().optional(),
  })
  .strict();
export async function POST(req: NextRequest) {
  return withSubmissionAccess(req, async (access) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AccessError(400, "批量操作参数无效");
    const { submissionIds, action, reason } = parsed.data;
    const items = await mutateSubmissions(
      access.userId,
      submissionIds.map(BigInt),
      action,
      action === "reject" ? { reason } : {},
    );
    return NextResponse.json({ count: items.length });
  });
}
