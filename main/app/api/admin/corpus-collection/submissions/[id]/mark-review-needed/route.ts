import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeSubmission, submissionInclude } from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async (_req, userId) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const body = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    const submission = await prisma.corpus_collection_submissions.update({
      where: { id },
      data: {
        review_status: "review_needed",
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_reason: body.reason || null,
      },
      include: submissionInclude,
    });
    return NextResponse.json(serializeSubmission(submission));
  });
}
