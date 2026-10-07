import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPLICATION_STATUSES } from "@/lib/library/application-workflow";
import {
  PRIVATE_HEADERS,
  requireCapability,
  withLibraryOps,
} from "@/lib/library/ops-access";
import {
  serializeApplication,
  userNames,
} from "@/lib/library/contribution-service";

export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "contribution_review");
    const params = new URL(req.url).searchParams;
    const q = (params.get("q") ?? "").trim().slice(0, 100);
    const status = params.get("status");
    const mine = params.get("mine") === "1";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));

    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (status && (APPLICATION_STATUSES as readonly string[]).includes(status))
      conditions.push(Prisma.sql`status = ${status}`);
    if (mine) conditions.push(Prisma.sql`current_handler_id = ${access.userId}`);
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(Prisma.sql`(
        application_no ILIKE ${like} OR dataset_name ILIKE ${like} OR
        contact_name ILIKE ${like} OR organization_name ILIKE ${like} OR
        contact_email ILIKE ${like})`);
    }
    const where = Prisma.join(conditions, " AND ");
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [idRows, totalRows, statusCounts, acceptedThisMonth] =
      await prisma.$transaction([
        // Pending initial review first, then newest submissions.
        prisma.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM contribution_applications WHERE ${where}
          ORDER BY (status = 'PENDING_INITIAL_REVIEW') DESC, created_at DESC, id DESC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM contribution_applications WHERE ${where}`,
        prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
          SELECT status, count(*)::bigint AS count FROM contribution_applications GROUP BY status`,
        prisma.ingestion_leads.count({ where: { created_at: { gte: monthStart } } }),
      ]);
    const ids = idRows.map((r) => r.id);
    const rows = ids.length
      ? await prisma.contribution_applications.findMany({ where: { id: { in: ids } } })
      : [];
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const ordered = ids.map((id) => byId.get(String(id))!).filter(Boolean);
    const names = await userNames(ordered.map((r) => r.current_handler_id));
    return NextResponse.json(
      {
        items: ordered.map((r) => serializeApplication(r, names)),
        total: Number(totalRows[0]?.count ?? 0),
        page,
        pageSize,
        stats: {
          byStatus: Object.fromEntries(
            statusCounts.map((s) => [s.status, Number(s.count)]),
          ),
          acceptedThisMonth,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
