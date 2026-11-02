import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminApps, saveApplication } from "@/lib/app-store/service";
import { appDraftSchema } from "@/lib/app-store/model";
import { storeFailure, PRIVATE } from "@/lib/app-store/http";
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      return NextResponse.json(
        {
          apps: await adminApps(),
          writesEnabled: process.env.APP_STORE_WRITES_ENABLED === "true",
        },
        { headers: PRIVATE },
      );
    } catch (e) {
      return storeFailure(e);
    }
  });
}
export async function POST(req: NextRequest) {
  return requireAdmin(req, async (_req, actor) => {
    try {
      const draft = appDraftSchema.parse(await req.json());
      return NextResponse.json(
        await saveApplication(actor, { draft, revision: 0, action: "save" }),
        { status: 201, headers: PRIVATE },
      );
    } catch (e) {
      return storeFailure(e);
    }
  });
}
