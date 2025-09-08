import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      // 清理该用户的过期和已使用的 nonce
      await prisma.walletNonce.deleteMany({
        where: {
          userId,
          OR: [{ expiresAt: { lt: new Date() } }, { used: true }],
        },
      });

      // 生成新的 nonce
      const nonce = randomBytes(32).toString("hex");
      const timestamp = Date.now();
      const message = `Bind wallet to DimSum account
Nonce: ${nonce}
Timestamp: ${timestamp}
User ID: ${userId}
Domain: dimsum-app.com`;

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

      const walletNonce = await prisma.walletNonce.create({
        data: {
          userId,
          nonce,
          message,
          expiresAt,
        },
      });

      return NextResponse.json({
        nonce: walletNonce.nonce,
        message: walletNonce.message,
        expires: walletNonce.expiresAt.getTime(),
      });
    } catch (error) {
      console.error("Failed to generate nonce:", error);
      return NextResponse.json(
        { error: "Failed to generate nonce" },
        { status: 500 }
      );
    }
  });
}
