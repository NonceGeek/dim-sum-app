import { withAdminAccess } from "@/lib/admin/access";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access) => NextResponse.json(access));
}
