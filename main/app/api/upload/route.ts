import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OssUploadValidationError, uploadFileToOss } from "@/lib/oss";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const uploaded = await uploadFileToOss({
        file,
        ownerId: userId,
        purpose: "avatar",
      });

      return NextResponse.json({
        url: uploaded.url,
        name: uploaded.name,
      });
    } catch (error) {
      if (error instanceof OssUploadValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("Upload error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to upload file" },
        { status: 500 }
      );
    }
  });
}
