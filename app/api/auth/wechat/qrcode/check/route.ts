import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket is required" },
        { status: 400 }
      );
    }

    // Check QR code status from WeChat API
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/qrcode/get?access_token=${process.env.WECHAT_ACCESS_TOKEN}&ticket=${ticket}`
    );

    const data = await response.json();

    if (data.errcode) {
      throw new Error(`WeChat API Error: ${data.errcode} - ${data.errmsg}`);
    }

    // If the QR code has been scanned, return success
    if (data.status === "scanned") {
      return NextResponse.json({ status: "scanned" });
    }

    return NextResponse.json({ status: "waiting" });
  } catch (error) {
    console.error("Failed to check QR code status:", error);
    return NextResponse.json(
      { error: "Failed to check QR code status" },
      { status: 500 }
    );
  }
} 