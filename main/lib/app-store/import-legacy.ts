// One-time operator import. Runtime APIs must never call this module.
import type { PrismaClient } from "@prisma/client";
import { legacyDraft } from "./model";

export async function importLegacyApplications(
  db: PrismaClient,
  apply = false,
) {
  return db.$transaction(
    async (tx) => {
      if (apply)
        await tx.$executeRawUnsafe(
          "LOCK TABLE public.app_store_profiles IN SHARE ROW EXCLUSIVE MODE",
        );
      const legacy = await tx.cantonese_corpus_apps.findMany({
        orderBy: { id: "asc" },
      });
      const existing = new Set(
        (
          await tx.app_store_profiles.findMany({ select: { app_id: true } })
        ).map((r) => String(r.app_id)),
      );
      const pending = legacy.filter((row) => !existing.has(String(row.id)));
      if (!apply)
        return {
          legacy: legacy.length,
          existing: existing.size,
          pending: pending.length,
          imported: 0,
        };
      const data = pending.map((row) => {
        const draft = legacyDraft(row);
        return {
          app_id: row.id,
          status: "published",
          revision: 1,
          draft_data: draft,
          published_data: draft,
          published_at: row.created_at,
          updated_at: row.updated_at ?? row.created_at,
        };
      });
      const result = await tx.app_store_profiles.createMany({
        data,
        skipDuplicates: true,
      });
      // Explicit legacy IDs must not collide with subsequent independent draft IDs.
      await tx.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('public.app_store_profiles', 'app_id'),
      COALESCE((SELECT MAX(app_id) FROM public.app_store_profiles), 1),
      EXISTS(SELECT 1 FROM public.app_store_profiles))`);
      return {
        legacy: legacy.length,
        existing: existing.size,
        pending: pending.length,
        imported: result.count,
      };
    },
    { timeout: 60_000 },
  );
}
