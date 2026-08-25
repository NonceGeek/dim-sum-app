// app/api/public/hot-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const raw = Number.parseInt(
      req.nextUrl.searchParams.get("count") ?? "6",
      10
    );
    const count = Math.min(Number.isNaN(raw) || raw < 1 ? 6 : raw, 20);

    // 当前数据规模下，单次随机查询比 COUNT + 大 OFFSET 更快、更稳定，
    // 同时减少一次到 Supabase Pooler 的网络往返。
    const rows = await prisma.$queryRaw<Array<{ data: string }>>(
      Prisma.sql`
        SELECT data
        FROM cantonese_corpus_all
        ORDER BY random()
        LIMIT ${count}
      `
    );

    return NextResponse.json({ terms: rows.map((row) => row.data) });
  });
}
