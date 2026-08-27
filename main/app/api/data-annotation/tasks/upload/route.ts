import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OssUploadValidationError, uploadFileToOss } from "@/lib/oss";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (_req, userId) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const fileNameValue = formData.get("fileName");
      const fileName = typeof fileNameValue === "string" ? fileNameValue : null;

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No file provided or invalid file format" },
          { status: 400 }
        );
      }

      const uploaded = await uploadFileToOss({
        file,
        fileName,
        ownerId: userId,
        purpose: "submissionMedia",
      });

      return NextResponse.json({
        success: true,
        url: uploaded.url,
        key: uploaded.name,
        name: uploaded.name,
      });
    } catch (error) {
      if (error instanceof OssUploadValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("Upload handler error:", error);
      return NextResponse.json(
        { error: "Internal server error processing upload" },
        { status: 500 }
      );
    }
  });
}
