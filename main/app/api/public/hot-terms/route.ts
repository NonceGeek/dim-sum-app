// app/api/public/hot-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const count = Math.min(parseInt(searchParams.get("count") ?? "6", 10), 20);

    const rows = await prisma.$queryRaw<Array<{ data: string }>>(
      Prisma.sql`SELECT data FROM cantonese_corpus_all ORDER BY RANDOM() LIMIT ${count}`
    );

    return NextResponse.json({ terms: rows.map((r) => r.data) });
  });
}
