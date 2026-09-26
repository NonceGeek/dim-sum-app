import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { withSubmissionAccess, submissionScope } from "@/lib/services/submission-access";
import { COLLECTION_ACTIONS, canAct } from "@/lib/collection-permissions";
import { prisma } from "@/lib/prisma";
import {
  parseBigIntId,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return withSubmissionAccess(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    const submission = await prisma.corpus_collection_submissions.findFirst({
      where: { id, ...submissionScope(access) },
      include: submissionInclude,
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    return NextResponse.json(serializeSubmission(submission));
  });
}
