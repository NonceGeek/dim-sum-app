import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    // 这里可以是从数据库或其他服务获取数据
    const basicInfo = {
      appName: "DimSum App",
      version: "1.0.0",
      features: [
        "Cantonese Dictionary",
        "Search Functionality",
        "User Profiles"
      ],
      lastUpdated: new Date().toISOString(),
      supportedLanguages: ["en", "zh-HK", "zh-CN"],
      contact: {
        website: "https://dimsum.app"
      }
    };

    return NextResponse.json(basicInfo);
  });
} 