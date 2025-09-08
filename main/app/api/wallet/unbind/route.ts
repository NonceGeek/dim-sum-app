import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      // 检查用户是否已绑定钱包
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ethAddress: true }
      });

      if (!user?.ethAddress) {
        return NextResponse.json(
          { error: "No wallet bound to this account" },
          { status: 400 }
        );
      }

      // 解绑钱包
      await prisma.user.update({
        where: { id: userId },
        data: { ethAddress: null }
      });

      return NextResponse.json({ 
        success: true,
        message: "Wallet unbound successfully"
      });
    } catch (error) {
      console.error('Failed to unbind wallet:', error);
      return NextResponse.json(
        { error: "Failed to unbind wallet" },
        { status: 500 }
      );
    }
  });
}