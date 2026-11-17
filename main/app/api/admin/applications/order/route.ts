import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PRIVATE, storeFailure } from "@/lib/app-store/http";
import { MAX_APP_RANK } from "@/lib/app-store/model";
import { adminAppOrder, reorderApplications } from "@/lib/app-store/service";

const orderSchema = z.object({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  ids: z.array(z.string()).min(2).max(MAX_APP_RANK),
});

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      return NextResponse.json(await adminAppOrder(), { headers: PRIVATE });
    } catch (error) {
      return storeFailure(error);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return requireAdmin(req, async (_req, actor) => {
    try {
      const { version, ids } = orderSchema.parse(await req.json());
      await reorderApplications(actor, version, ids);
      return new NextResponse(null, { status: 204, headers: PRIVATE });
    } catch (error) {
      return storeFailure(error);
    }
  });
}
