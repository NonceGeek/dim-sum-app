import { activitySql,withAdminAccess } from "@/lib/admin/access";
import { NextRequest,NextResponse } from "next/server";

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
  return withAdminAccess(req, async (access, db) => {
    const [types, tags] = await Promise.all([
      db.$queryRaw<TypeRow[]>`
        SELECT
          "submission_type",
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE "review_status" = 'approved')::bigint AS approved,
          COUNT(*) FILTER (WHERE "review_status" = 'rejected')::bigint AS rejected
        FROM "corpus_collection_submissions"
        WHERE ${activitySql(access)}
        GROUP BY "submission_type"
        ORDER BY total DESC
      `,
      db.$queryRaw<TagRow[]>`
        SELECT tag, COUNT(*)::bigint AS total
        FROM "corpus_collection_submissions",
          jsonb_array_elements_text("tags") AS tag
        WHERE ${activitySql(access)}
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
