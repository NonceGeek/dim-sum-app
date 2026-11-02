import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SearchError } from "./contracts";
import { eligibleSql, getEntry } from "./service";
import { formatEntry, type SearchRow } from "./content";
import {
  dailyEntrySchema, resolveDailyEntry, type DailyWindow, type StoredDaily,
  type DailyRepository,
} from "./daily-entry";

type Reader = Pick<Prisma.TransactionClient, "$queryRaw">;
type DailyRow = { entry_id: string; entry: unknown };
async function readDaily(db: Reader, date: string): Promise<StoredDaily | null> {
  const rows = await db.$queryRaw<DailyRow[]>`
    SELECT entry_id::text, entry FROM search_daily_entries WHERE date=${date}::date
  `;
  return rows[0] ? { entryId: rows[0].entry_id, entry: rows[0].entry } : null;
}

/** Bound costly JSON parsing to small batches; never fall back to raw/private data. */
export async function chooseDailyEntry(db: Reader, date: string) {
  // Seek through the UUID index from a date-derived pivot, wrapping once.
  // Limit candidates BEFORE JSON/visibility work; never sort the full corpus.
  const hash = createHash("sha256").update(`search-app:${date}`).digest("hex");
  const pivot = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const size = 64;
  for (const wrap of [false, true]) {
    let after: string | null = null;
    for (;;) {
      const range = wrap ? Prisma.sql`c.unique_id < ${pivot}::uuid` : Prisma.sql`c.unique_id >= ${pivot}::uuid`;
      const candidates = await db.$queryRaw<Array<{ id: string }>>`
        SELECT c.unique_id::text AS id FROM cantonese_corpus_all c
        WHERE ${range} ${after ? Prisma.sql`AND c.unique_id > ${after}::uuid` : Prisma.empty}
        ORDER BY c.unique_id LIMIT ${size}
      `;
      if (!candidates.length) break;
      const rows = await db.$queryRaw<SearchRow[]>(eligibleSql(
        Prisma.sql`c.unique_id IN (${Prisma.join(candidates.map((c) => Prisma.sql`${c.id}::uuid`))})`,
      ));
      const byId = new Map(rows.map((row) => [row.unique_id, row]));
      for (const candidate of candidates) {
        const row = byId.get(candidate.id);
        if (row) return dailyEntrySchema.parse(formatEntry(row));
      }
      if (candidates.length < size) break;
      after = candidates[candidates.length - 1].id;
    }
  }
  throw new SearchError(503, "NO_DAILY_ENTRY", "暂时没有可展示的今日内容");
}

export async function loadOrCreateDaily(tx: Prisma.TransactionClient, window: DailyWindow) {
  // A cross-instance transaction lock serializes the first selection of each day.
  await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${`search-app:daily:${window.date}`},0))`;
  const existing = await readDaily(tx, window.date);
  if (existing) return existing;
  const entry = await chooseDailyEntry(tx, window.date);
  await tx.$executeRaw`
    INSERT INTO search_daily_entries (date,entry_id,entry)
    VALUES (${window.date}::date,${entry.id}::uuid,${JSON.stringify(entry)}::jsonb)
  `;
  return { entryId: entry.id, entry };
}

export const dailyRepository: DailyRepository = {
  async getOrCreate(window) {
    // Warm reads avoid the initialization lock and a write transaction.
    const existing = await readDaily(prisma, window.date);
    if (existing) return existing;
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
      await tx.$executeRaw`SET LOCAL jit=off`;
      return loadOrCreateDaily(tx, window);
    }, { maxWait: 10000, timeout: 15000 });
  },
  async isAvailable(id) {
    // A saved snapshot never overrides current public/oral/definition eligibility.
    return (await getEntry(id)) !== null;
  },
};

export const getDailyEntry = () => resolveDailyEntry(dailyRepository);
