import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TypeRow = {
  submission_type: string;
  total: bigint;
  approved: bigint;
  rejected: bigint;
};

type TagRow = {
  tag: string;
  total: bigint;
};

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const [types, tags] = await Promise.all([
      prisma.$queryRaw<TypeRow[]>`
        SELECT
          "submission_type",
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE "review_status" = 'approved')::bigint AS approved,
          COUNT(*) FILTER (WHERE "review_status" = 'rejected')::bigint AS rejected
        FROM "corpus_collection_submissions"
        GROUP BY "submission_type"
        ORDER BY total DESC
      `,
      prisma.$queryRaw<TagRow[]>`
        SELECT tag, COUNT(*)::bigint AS total
        FROM "corpus_collection_submissions",
          jsonb_array_elements_text("tags") AS tag
        GROUP BY tag
        ORDER BY total DESC
        LIMIT 50
      `,
    ]);

    return NextResponse.json({
      types: types.map((row) => ({
        submissionType: row.submission_type,
        total: Number(row.total),
        approved: Number(row.approved),
        rejected: Number(row.rejected),
      })),
      tags: tags.map((row) => ({
        tag: row.tag,
        total: Number(row.total),
      })),
    });
  });
}
