import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId, serializeSubmission } from "@/lib/services/corpus-collection";
import { AccessError, withSubmissionAccess } from "@/lib/services/submission-access";
import { mutateSubmissions } from "@/lib/services/submission-mutations";

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return withSubmissionAccess(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "Invalid submission id");
    const body = await req.json().catch(() => ({}));
    const [submission] = await mutateSubmissions(access.userId, [id], "award", body);
    return NextResponse.json(serializeSubmission(submission));
  });
}
