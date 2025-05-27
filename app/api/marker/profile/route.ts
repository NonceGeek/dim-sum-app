import { NextRequest, NextResponse } from "next/server";
import { requireMarker } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  return requireMarker(req, async (req, userId) => {
    // 获取标记员信息
    const marker = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        phoneNumber: true,
      },
    });

    if (!marker) {
      return new NextResponse(
        JSON.stringify({ error: "Marker not found" }),
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: marker.id,
      name: marker.name,
      email: marker.email,
      image: marker.image,
      role: marker.role,
      phoneNumber: marker.phoneNumber,
      isMarker: true,
      lastAccessed: new Date().toISOString(),
    });
  });
} 