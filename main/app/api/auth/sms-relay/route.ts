import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAliyunSmsService } from "@/lib/services/aliyun-sms";

export const dynamic = "force-dynamic";

function secretsMatch(received: string | null, expected: string): boolean {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.ALIYUN_SMS_RELAY_SECRET?.trim();
  if (
    !secret ||
    !secretsMatch(request.headers.get("x-aliyun-sms-relay-token"), secret)
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as {
    phoneNumber?: unknown;
    code?: unknown;
  } | null;
  if (
    !input ||
    typeof input.phoneNumber !== "string" ||
    typeof input.code !== "string" ||
    !/^\d{6}$/.test(input.code)
  ) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const result = await getAliyunSmsService().sendSmsCodeDirect(
    input.phoneNumber,
    input.code,
  );
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
