import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeSubmission, submissionInclude } from "@/lib/services/corpus-collection";

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const body = await req.json();
    if (!id) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    const submission = await prisma.corpus_collection_submissions.update({
      where: { id },
      data: {
        is_featured: typeof body.isFeatured === "boolean" ? body.isFeatured : undefined,
        show_on_home: typeof body.showOnHome === "boolean" ? body.showOnHome : undefined,
        visibility: body.visibility,
      },
      include: submissionInclude,
    });
    return NextResponse.json(serializeSubmission(submission));
  });
}
