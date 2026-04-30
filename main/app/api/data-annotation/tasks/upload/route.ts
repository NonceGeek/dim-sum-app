import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return requireAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const fileName = formData.get("fileName") as string | null;

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No file provided or invalid file format" },
          { status: 400 }
        );
      }

      const upstreamFormData = new FormData();
      upstreamFormData.append("password", process.env.ADMIN_PASSWORD || "");
      upstreamFormData.append("bucket", "dimsum-audio");
      upstreamFormData.append("dir", "tagger/");

      if (fileName) {
        upstreamFormData.append("fileName", fileName);
        upstreamFormData.append("file", file, fileName);
      } else {
        upstreamFormData.append("file", file);
      }

      const response = await fetch(
        `${process.env.BACKEND_URL}/admin/oss/upload`,
        {
          method: "POST",
          body: upstreamFormData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upstream upload failed:", response.status, errorText);
        return NextResponse.json(
          { error: "Upstream upload failed", details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error("Upload handler error:", error);
      return NextResponse.json(
        { error: "Internal server error processing upload" },
        { status: 500 }
      );
    }
  });
}
