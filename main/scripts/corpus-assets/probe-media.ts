/**
 * #509 corpus asset probe: registers every media URL referenced by corpus notes in
 * corpus_media_assets, then fills size (HEAD Content-Length, falling back to a
 * 1-byte Range GET) and, for audio/video, duration (ffprobe). Re-runnable; only
 * pending rows are probed unless --retry-failed is given.
 *
 *   node --import tsx scripts/corpus-assets/probe-media.ts [--limit 500] [--concurrency 8] [--retry-failed] [--register-only]
 *
 * Requires ffprobe on PATH for durations. Writes only corpus_media_assets.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const run = promisify(execFile);
const arg = (name: string) => process.argv.includes(`--${name}`);
const num = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

type Probe = { size: bigint | null; contentType: string | null; duration: number | null; error: string | null };

async function probeSize(url: string): Promise<Pick<Probe, "size" | "contentType">> {
  const head = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) });
  const length = head.ok ? head.headers.get("content-length") : null;
  if (head.ok && length) return { size: BigInt(length), contentType: head.headers.get("content-type") };
  const ranged = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  await ranged.body?.cancel();
  const total = ranged.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  if (!ranged.ok || !total) throw new Error(`HTTP ${head.status}/${ranged.status}`);
  return { size: BigInt(total), contentType: ranged.headers.get("content-type") };
}

async function probeDuration(url: string) {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", url],
    { timeout: 60_000 },
  );
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("ffprobe returned no duration");
  return seconds;
}

async function probe(rawUrl: string, kind: string): Promise<Probe> {
  const result: Probe = { size: null, contentType: null, duration: null, error: null };
  let url: string;
  try {
    url = new URL(rawUrl).href; // percent-encodes non-ASCII paths such as 粤语.m4a
    if (!/^https?:/.test(url)) throw new Error("not http(s)");
  } catch (e) {
    return { ...result, error: `invalid url: ${(e as Error).message}` };
  }
  const errors: string[] = [];
  try {
    Object.assign(result, await probeSize(url));
  } catch (e) {
    errors.push(`size: ${(e as Error).message}`);
  }
  if (kind === "audio" || kind === "video") {
    try {
      result.duration = await probeDuration(url);
    } catch (e) {
      errors.push(`duration: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  result.error = errors.length ? errors.join("; ").slice(0, 500) : null;
  return result;
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { registerReferencedMedia } = await import("@/lib/analytics/corpus-assets");

  const added = await registerReferencedMedia();
  const counts = await prisma.corpus_media_assets.groupBy({ by: ["probe_status"], _count: true });
  console.log(`registered ${added} new urls;`, Object.fromEntries(counts.map((c) => [c.probe_status, c._count])));
  if (arg("register-only")) return prisma.$disconnect();

  const queue = await prisma.corpus_media_assets.findMany({
    where: { probe_status: { in: arg("retry-failed") ? ["pending", "failed"] : ["pending"] } },
    select: { url: true, media_type: true },
    orderBy: { url: "asc" },
    take: num("limit", 500),
  });
  let done = 0;
  let failed = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const r = await probe(item.url, item.media_type);
      const needsDuration = item.media_type === "audio" || item.media_type === "video";
      const ok = r.size !== null && (!needsDuration || r.duration !== null);
      await prisma.corpus_media_assets.update({
        where: { url: item.url },
        data: {
          size_bytes: r.size,
          content_type: r.contentType,
          duration_seconds: r.duration,
          probe_status: ok ? "ok" : "failed",
          probe_error: r.error,
          probed_at: new Date(),
        },
      });
      done += 1;
      if (!ok) failed += 1;
      if (done % 100 === 0) console.log(`probed ${done} (failed ${failed})`);
    }
  };
  await Promise.all(Array.from({ length: num("concurrency", 8) }, worker));
  console.log(`finished: probed ${done}, failed ${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
