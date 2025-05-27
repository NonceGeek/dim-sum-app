import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get QR code from WeChat API
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${process.env.WECHAT_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expire_seconds: 300, // QR code expires in 5 minutes
          action_name: "QR_STR_SCENE",
          action_info: {
            scene: {
              scene_str: "login", // You can customize this string
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (data.errcode) {
      throw new Error(`WeChat API Error: ${data.errcode} - ${data.errmsg}`);
    }

    // 返回二维码信息
    return NextResponse.json({
      ticket: data.ticket,
      expire_seconds: data.expire_seconds,
      url: data.url,
      qrcode_url: `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(data.ticket)}`,
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
} 