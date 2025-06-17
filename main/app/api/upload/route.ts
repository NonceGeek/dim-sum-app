import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import OSS from 'ali-oss';

const client = new OSS({
  region: process.env.ALIYUN_OSS_REGION,
  accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
  bucket: process.env.ALIYUN_OSS_BUCKET!,
  secure: true, // 使用 HTTPS
});

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
      
      const result = await client.put(filename, Buffer.from(buffer), {
        headers: {
          'Content-Type': file.type,
        },
      });
      
      // 确保返回 HTTPS URL
      const url = result.url.replace('http://', 'https://');
      
      return NextResponse.json({
        url,
        name: filename
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