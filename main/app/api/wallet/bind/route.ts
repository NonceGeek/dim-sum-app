import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyMessage } from "ethers";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const { address, signature, nonce } = await req.json();

      // 验证输入参数
      if (!address || !signature || !nonce) {
        return NextResponse.json(
          { error: "Missing required parameters" },
          { status: 400 }
        );
      }

      // 查找并验证 nonce
      const walletNonce = await prisma.walletNonce.findFirst({
        where: {
          nonce,
          userId,
          used: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (!walletNonce) {
        return NextResponse.json(
          { error: "Invalid or expired nonce" },
          { status: 400 }
        );
      }

      // 验证签名
      let recoveredAddress: string;
      try {
        recoveredAddress = verifyMessage(walletNonce.message, signature);
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json(
          { error: "Signature does not match address" },
          { status: 400 }
        );
      }

      // 检查地址是否已被其他用户绑定
      const existingUser = await prisma.user.findFirst({
        where: {
          ethAddress: address.toLowerCase(),
          NOT: { id: userId }
        }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "This wallet is already bound to another account" },
          { status: 409 }
        );
      }

      // 使用事务绑定钱包并标记 nonce 为已使用
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { ethAddress: address.toLowerCase() }
        });

        await tx.walletNonce.update({
          where: { id: walletNonce.id },
          data: { used: true }
        });
      });

      return NextResponse.json({ 
        success: true,
        address: address.toLowerCase()
      });
    } catch (error) {
      console.error('Failed to bind wallet:', error);
      return NextResponse.json(
        { error: "Failed to bind wallet" },
        { status: 500 }
      );
    }
  });
}