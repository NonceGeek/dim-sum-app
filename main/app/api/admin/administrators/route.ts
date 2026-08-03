import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireSuperAdmin(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search")?.trim() || "";

      const users = await prisma.user.findMany({
        where: {
          status: { not: "MERGED" },
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { phoneNumber: { contains: search } },
                ],
              }
            : {}),
        },
        orderBy: [{ isSuperAdmin: "desc" }, { isSystemAdmin: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          isSystemAdmin: true,
          isSuperAdmin: true,
        },
      });

      return NextResponse.json({ users });
    } catch (error) {
      console.error("Failed to fetch administrator candidates:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(req: NextRequest) {
  return requireSuperAdmin(req, async () => {
    try {
      const { userId, isSystemAdmin } = await req.json();

      if (!userId || typeof isSystemAdmin !== "boolean") {
        return NextResponse.json(
          { error: "userId and isSystemAdmin are required" },
          { status: 400 }
        );
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true, status: true },
      });

      if (!target || target.status === "MERGED") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (target.isSuperAdmin && !isSystemAdmin) {
        return NextResponse.json(
          { error: "Super admin access cannot be revoked here" },
          { status: 400 }
        );
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { isSystemAdmin },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          isSystemAdmin: true,
          isSuperAdmin: true,
        },
      });

      return NextResponse.json({
        message: isSystemAdmin
          ? "Administrator access granted"
          : "Administrator access revoked",
        user,
      });
    } catch (error) {
      console.error("Failed to update administrator access:", error);
      return NextResponse.json(
        { error: "Failed to update administrator access" },
        { status: 500 }
      );
    }
  });
}
