import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { saveApplication } from "@/lib/app-store/service";
import { appDraftSchema } from "@/lib/app-store/model";
import { storeFailure, PRIVATE } from "@/lib/app-store/http";
const schema = z.object({
  revision: z.number().int().nonnegative(),
  draft: appDraftSchema,
  action: z.enum(["save", "publish", "offline"]),
});
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return requireAdmin(req, async (_req, actor) => {
    try {
      const input = schema.parse(await req.json());
      return NextResponse.json(
        await saveApplication(actor, {
          revision: input.revision,
          draft: input.draft,
          action: input.action,
          id: (await context.params).id,
        }),
        { headers: PRIVATE },
      );
    } catch (e) {
      return storeFailure(e);
    }
  });
}
