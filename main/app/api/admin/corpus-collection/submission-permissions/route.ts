import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ error: "请使用业务范围权限管理", endpoint: "/api/admin/business-permissions" }, { status: 410 }); }
export const PUT = GET;
