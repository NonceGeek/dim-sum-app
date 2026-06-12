import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { backendFetch } from "@/lib/api/backend";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
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

      // Prepare upstream form data
      const upstreamFormData = new FormData();
      upstreamFormData.append(
        "password",
        process.env.ADMIN_PASSWORD || ""
      );
      upstreamFormData.append("bucket", "dimsum-audio");
      upstreamFormData.append("dir", "tagger/");
      
      console.log(`[Upload] File received. Original name: ${file instanceof File ? file.name : 'unknown'}, Size: ${file.size}`);
      if (fileName) {
        // console.log(`[Upload] Using custom filename: ${fileName}`);
        // Pass fileName explicitly as a field for reliable renaming
        upstreamFormData.append("fileName", fileName);
        // Also keep the renaming in the file appendage for good measure, though the explicit field takes precedence now
        upstreamFormData.append("file", file, fileName);
      } else {
        // console.log(`[Upload] Using original filename`);
        upstreamFormData.append("file", file);
      }

      // Call upstream API
      const response = await backendFetch("/admin/oss/upload", {
        method: "POST",
        body: upstreamFormData,
        // duplicate-headers are usually handled automatically by fetch with FormData
      });

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
