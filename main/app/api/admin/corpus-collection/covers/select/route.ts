import { withAdminAccess } from "@/lib/admin/access";
import { assertCoverAccess,generatedCoverUrl, readCoverImage } from "@/lib/admin/cover-access";
import { AccessError } from "@/lib/admin/security";
import { uploadBufferToOss } from "@/lib/oss";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import type { Prisma as AdminPrisma } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

function extensionFromContentType(contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    const body = await req.json().catch(() => ({}));
    await assertCoverAccess(access, body, db);
    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const activityId = parseBigIntId(body.activityId);
    const submissionId = parseBigIntId(body.submissionId);

    const source = await fetch(generatedCoverUrl(body.url), { cache: "no-store", redirect: "error" });
    if (!source.ok) {
      return NextResponse.json(
        { error: "Failed to fetch selected cover" },
        { status: 502 }
      );
    }

    const contentType = source.headers.get("content-type");
    const buffer = await readCoverImage(source);
    const extension = extensionFromContentType(contentType);
    const objectName = `corpus-collection/covers/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const uploaded = await uploadBufferToOss(objectName, buffer, contentType, "corpusAsset");

    if (activityId || submissionId) {
      await (async (tx: AdminPrisma.TransactionClient) => {
        if (activityId) {
          await tx.corpus_collection_activities.update({
            where: { id: activityId },
            data: { banner_url: uploaded.url },
          });
        }

        if (submissionId) {
          await tx.corpus_collection_submission_media.create({
            data: {
              submission_id: submissionId,
              media_type: "image",
              url: uploaded.url,
              sort_order: 0,
              metadata: { cover: true, sourceUrl: body.url } as Prisma.InputJsonValue,
            },
          });
        }
      })(db);
    }

    return NextResponse.json(uploaded);
  });
}
