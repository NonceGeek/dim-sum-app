import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { uploadFileToOss, OssUploadValidationError } from "@/lib/oss";
import { PRIVATE, storeFailure } from "@/lib/app-store/http";
import { assertWritesEnabled, StoreError } from "@/lib/app-store/service";
export async function POST(req: NextRequest) {
  return requireAdmin(req, async (_req, user) => {
    try {
      assertWritesEnabled();
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new StoreError(400, "File required");
      const result = await uploadFileToOss({
        file,
        ownerId: user,
        purpose: "appStore",
      });
      return NextResponse.json({ url: result.url }, { headers: PRIVATE });
    } catch (e) {
      return storeFailure(
        e instanceof OssUploadValidationError
          ? new StoreError(400, e.message)
          : e,
      );
    }
  });
}
