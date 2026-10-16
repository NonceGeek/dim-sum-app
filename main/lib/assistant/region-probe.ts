// 临时：测量各 Vercel 区域到 DashScope 与数据库的延迟，选定区域后删除
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function timed<T>(run: () => Promise<T>) {
  const start = Date.now();
  try {
    await run();
    return { ms: Date.now() - start, ok: true };
  } catch (error) {
    return { ms: Date.now() - start, ok: false, error: String(error).slice(0, 120) };
  }
}

export function regionProbe(req: NextRequest) {
  return requireAuth(req, async () => {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY;
    const chat = () =>
      fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "qwen-plus", messages: [{ role: "user", content: "回复OK" }], max_tokens: 5 }),
      }).then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      });
    const db = () => prisma.$queryRaw`select 1`;
    return NextResponse.json({
      region: process.env.VERCEL_REGION ?? null,
      dashscopeFirst: await timed(chat),
      dashscopeSecond: await timed(chat),
      dbFirst: await timed(db),
      dbSecond: await timed(db),
    });
  });
}
