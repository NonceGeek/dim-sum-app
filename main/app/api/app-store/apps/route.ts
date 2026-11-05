import { NextRequest, NextResponse } from "next/server";
import { publicApps } from "@/lib/app-store/service";
import { catalog } from "@/lib/app-store/model";
import { storeFailure } from "@/lib/app-store/http";
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const apps = catalog(
      await publicApps(),
      (p.get("q") ?? "").slice(0, 100),
      p.get("category") ?? "",
      p.get("instant") === "true",
      p.get("sort") ?? "recommended",
    );
    return NextResponse.json(
      { apps },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return storeFailure(e);
  }
}
