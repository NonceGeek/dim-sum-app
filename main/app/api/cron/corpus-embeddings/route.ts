import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCorpusEmbeddings } from "@/lib/corpus/corpus-embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Candidates are cheap to scan and diff; embedding work stops at the deadline and resumes next run.
const CANDIDATE_LIMIT = 200;
const DEADLINE_MS = 45_000;

// Invoked hourly by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
// `?dryRun=1` reports the content_ref diff without embedding or writing.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await syncCorpusEmbeddings(prisma, {
    limit: CANDIDATE_LIMIT,
    deadlineMs: DEADLINE_MS,
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
  });
  if (result.failed.length) {
    console.error("Corpus embedding sync had failures", { failed: result.failed });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
