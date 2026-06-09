// app/api/public/hot-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const raw = parseInt(searchParams.get("count") ?? "6", 10);
    const count = Math.min(isNaN(raw) || raw < 1 ? 6 : raw, 20);

    // ORDER BY RANDOM() 会全表扫描，大表上非常慢。
    // 改用随机 offset：先取总数，再随机跳过一段，性能大幅提升。
    const [countResult] = await prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`SELECT COUNT(*) as total FROM cantonese_corpus_all`
    );
    const total = Number(countResult.total);

    if (total === 0) {
      return NextResponse.json({ terms: [] });
    }

    // 随机取 count 条（多取一点再去重，防止 offset 撞车）
    const fetchCount = Math.min(count * 3, total);
    const maxOffset = Math.max(0, total - fetchCount);
    const offset = Math.floor(Math.random() * maxOffset);

    const rows = await prisma.$queryRaw<Array<{ data: string }>>(
      Prisma.sql`SELECT data FROM cantonese_corpus_all LIMIT ${fetchCount} OFFSET ${offset}`
    );

    // 随机打乱后取前 count 条
    const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, count);

    return NextResponse.json({ terms: shuffled.map((r) => r.data) });
  });
}
