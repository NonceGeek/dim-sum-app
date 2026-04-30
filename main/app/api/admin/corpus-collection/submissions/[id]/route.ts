import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBigIntId,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    const submission = await prisma.corpus_collection_submissions.findUnique({
      where: { id },
      include: submissionInclude,
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    return NextResponse.json(serializeSubmission(submission));
  });
}
