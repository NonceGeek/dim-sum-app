import { activitySql,withAdminAccess } from "@/lib/admin/access";
import { parsePositiveInt } from "@/lib/services/corpus-collection";
import { NextRequest,NextResponse } from "next/server";

type TrendRow = {
  period: Date;
  total: bigint;
  approved: bigint;
  rejected: bigint;
  pending: bigint;
};

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const days = parsePositiveInt(searchParams.get("days"), 30, 365);
  const groupBy = searchParams.get("groupBy") === "week" ? "week" : "day";

  return withAdminAccess(req, async (access, db) => {
    const rows = await db.$queryRaw<TrendRow[]>`
      SELECT
        date_trunc(${groupBy}, "created_at") AS period,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "review_status" = 'approved')::bigint AS approved,
        COUNT(*) FILTER (WHERE "review_status" = 'rejected')::bigint AS rejected,
        COUNT(*) FILTER (
          WHERE "review_status" IN ('pending_review', 'ai_reviewing', 'review_needed')
        )::bigint AS pending
      FROM "corpus_collection_submissions"
      WHERE ${activitySql(access)} AND "created_at" >= NOW() - (${days} * INTERVAL '1 day')
      GROUP BY period
      ORDER BY period ASC
    `;

    return NextResponse.json({
      items: rows.map((row) => ({
        period: row.period.toISOString(),
        total: Number(row.total),
        approved: Number(row.approved),
        rejected: Number(row.rejected),
        pending: Number(row.pending),
      })),
    });
  });
}
