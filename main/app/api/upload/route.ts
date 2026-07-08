import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { uploadBufferToOss } from "@/lib/oss";

// 允许的文件类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// 最大文件大小（5MB）
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // 验证文件类型
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed" },
          { status: 400 }
        );
      }

      // 验证文件大小
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "File size must be less than 5MB" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const filename = `${userId}/${Date.now()}-${file.name}`;

      const uploaded = await uploadBufferToOss(filename, Buffer.from(buffer), file.type);

      return NextResponse.json({
        url: uploaded.url,
        name: uploaded.name
      });
    } catch (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to upload file" },
        { status: 500 }
      );
    }
  });
}
