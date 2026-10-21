import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  DASHBOARD_TABS,
  type DashboardTab,
  loadDashboard,
  parseRange,
} from "@/lib/analytics/dashboard";

/** GET /api/admin/analytics?tab=overview|search|content|traffic&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const params = req.nextUrl.searchParams;
    const tab = params.get("tab") as DashboardTab;
    if (!DASHBOARD_TABS.includes(tab))
      return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    const range = parseRange(params.get("from"), params.get("to"));
    if (!range)
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    try {
      const data = await loadDashboard(tab, range);
      return NextResponse.json(
        { tab, from: range.from, to: range.to, data },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      console.error("Analytics dashboard query failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
  });
}
