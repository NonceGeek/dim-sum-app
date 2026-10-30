import { z } from "zod";
import { SearchError } from "./contracts";
import { httpsAudio } from "./content";

const audio = z.string().refine((value) => httpsAudio(value) !== null).nullable();
const example = z.object({
  text: z.string().min(1), translation: z.string().nullable(),
  jyutping: z.string().nullable(), audio,
}).strict();
export const dailyEntrySchema = z.object({
  id: z.string().uuid(), expression: z.string().trim().min(1),
  senses: z.array(z.object({
    meaning: z.string().trim().min(1), jyutping: z.string().nullable(), audio,
    usageNotes: z.string().nullable(), examples: z.array(example).max(3),
  }).strict()).min(1),
  source: z.object({
    datasetSlug: z.string(), datasetName: z.string(), licenses: z.array(z.string()),
  }).strict(),
  available: z.literal(true),
}).strict();
export type DailyEntry = z.infer<typeof dailyEntrySchema>;
export type DailyWindow = { date: string; expiresAt: string };
export type StoredDaily = { entryId: string; entry: unknown };
export interface DailyRepository {
  getOrCreate(window: DailyWindow): Promise<StoredDaily>;
  isAvailable(id: string): Promise<boolean>;
}

/** The product day is always Beijing time, independent of host/client timezone. */
export function dailyWindow(now: Date): DailyWindow {
  const date = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  return { date, expiresAt: new Date(midnight + 86400000).toISOString() };
}

export async function resolveDailyEntry(
  repository: DailyRepository,
  clock: () => Date = () => new Date(),
) {
  // A request crossing midnight must return the new day's selection, not an
  // already expired entry. This also keeps the cache timestamp authoritative.
  for (let attempt = 0; attempt < 2; attempt++) {
    const window = dailyWindow(clock());
    const record = await repository.getOrCreate(window);
    const parsed = dailyEntrySchema.safeParse(record.entry);
    if (!parsed.success || parsed.data.id !== record.entryId)
      throw new SearchError(503, "SERVICE_UNAVAILABLE", "今日内容暂不可用，请稍后重试");
    const available = await repository.isAvailable(record.entryId);
    const now = clock();
    if (dailyWindow(now).date !== window.date) continue;
    if (!available)
      throw new SearchError(404, "DAILY_ENTRY_UNAVAILABLE", "今日内容已下架，请明日再来");
    return {
      date: window.date, timeZone: "Asia/Shanghai" as const,
      serverTime: now.toISOString(), expiresAt: window.expiresAt, entry: parsed.data,
    };
  }
  throw new SearchError(503, "SERVICE_UNAVAILABLE", "请稍后重新获取今日内容");
}
