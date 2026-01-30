import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramMarker } from "@/lib/miniprogram-auth";

export async function POST(req: NextRequest) {
  return requireMiniprogramMarker(req, async (_req, user) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Prepare upstream form data
      const upstreamFormData = new FormData();
      upstreamFormData.append(
        "password",
        process.env.ADMIN_PASSWORD
      );
      upstreamFormData.append("bucket", "dimsum-audio");
      upstreamFormData.append("dir", "tagger/");
      upstreamFormData.append("file", file);

      // Call upstream API
      const response = await fetch("https://dim-sum-prod.deno.dev/admin/oss/upload", {
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
