import assert from "node:assert/strict";
// Integration checks use one rolled-back transaction; no QA rows are committed.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
if (process.env.DIRECT_URL) {
  const u = new URL(process.env.DIRECT_URL);
  u.searchParams.set("connection_limit", "1");
  u.searchParams.set("connect_timeout", "30");
  process.env.DATABASE_URL = u.href;
}
async function run() {
  const { Prisma } = await import("@prisma/client");
  const { prisma } = await import("@/lib/prisma");
  try {
    const { searchSql, getEntry } = await import(
      "@/lib/search-miniprogram/service"
    );
    const { formatEntry } = await import("@/lib/search-miniprogram/content");
    const { processFeedback } = await import("@/lib/search-miniprogram/admin");
    const { saveFeedback } = await import("@/lib/search-miniprogram/feedback");
    const { encodeCursor, decodeCursor } = await import(
      "@/lib/search-miniprogram/contracts"
    );
    const { randomUUID } = await import("node:crypto");
    const rollback = new Error("QA_ROLLBACK_SEARCH");
    const suffix = randomUUID().replaceAll("-", "");
    const word = "qa" + suffix;
    const checks: string[] = [];
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
          await tx.$executeRaw`SET LOCAL jit=off`;
          const cats = [];
          for (const [tag, is_public, content_attribute] of [
            ["oral", true, "oral"],
            ["private", false, "oral"],
            ["culture", true, "cultural_knowledge"],
          ] as const)
            cats.push(
              await tx.cantonese_categories.create({
                data: {
                  name: `qa_search_${suffix}_${tag}`,
                  is_public,
                  content_attribute,
                },
              }),
            );
          const add = (index: number, data: object) =>
            tx.cantonese_corpus_all.create({
              data: { data: word, category: cats[index].name, ...data },
            });
          const good = await add(0, {
            note: {
              context: {
                meaning: "QA meaning",
                粤语: "https://example.com/yue.wav",
              },
            },
          });
          await add(0, {
            data: word + "x",
            note: { context: { meaning: "QA related" } },
          });
          await add(0, {
            data: word + "__123456_aabbccdd",
            note: { context: { meaning: "QA duplicate" } },
          });
          await add(0, {
            data: "opaque_" + suffix,
            structured_note: {
              data: [
                {
                  blocks: [
                    { type: "sentence", content: word },
                    { type: "definition", content: "structured meaning" },
                  ],
                },
              ],
            },
          });
          const missing = await add(0, { note: {} });
          const privateRow = await add(1, {
            note: { context: { meaning: "hidden" } },
          });
          const culture = await add(2, {
            note: { context: { meaning: "culture" } },
          });
          const rows = await tx.$queryRaw<any[]>(searchSql(word, 20, null));
          assert.equal(rows.length, 4);
          assert.equal(rows[0].rank, 0);
          assert.equal(rows.filter((r) => r.rank === 0).length, 3);
          assert.equal(rows.at(-1)?.rank, 1);
          for (const r of rows) {
            assert.equal(formatEntry(r).available, true);
            assert.ok(r.meaning);
          }
          for (const id of [
            missing.unique_id,
            privateRow.unique_id,
            culture.unique_id,
          ])
            assert.equal(await getEntry(id, tx), null);
          assert.equal(
            (await getEntry(good.unique_id, tx))?.senses[0].audio,
            "https://example.com/yue.wav",
          );
          checks.push(
            "public oral eligibility before pagination, exact vs related, private/culture/missing definitions denied",
          );
          const page = await tx.$queryRaw<any[]>(searchSql(word, 1, null));
          const cursor = decodeCursor(
            word,
            encodeCursor(word, page[0].rank, page[0].id),
          );
          const next = await tx.$queryRaw<any[]>(searchSql(word, 20, cursor));
          assert.equal(next.length, 3);
          assert.ok(next.every((r) => r.id !== page[0].id));
          checks.push("keyset pagination and imported expression suffix");
          const input = {
            requestId: randomUUID(),
            anonymousId: randomUUID(),
            type: "other" as const,
            description: "QA test",
            entryId: good.unique_id,
          };
          const first = await saveFeedback(tx, input, null);
          const replay = await saveFeedback(tx, input, null);
          assert.equal(first.feedback.id, replay.feedback.id);
          assert.equal(replay.replayed, true);
          await assert.rejects(
            saveFeedback(tx, { ...input, description: "changed" }, null),
            (e) => (e as any).code === "REQUEST_CONFLICT",
          );
          checks.push(
            "anonymous feedback, idempotent retry, mismatched retry denied",
          );
          const user = await tx.user.create({
            data: { name: "Search API QA" },
          });
          const logged = await saveFeedback(
            tx,
            { ...input, requestId: randomUUID(), anonymousId: randomUUID() },
            user.id,
          );
          assert.equal(logged.feedback.user_id, user.id);
          checks.push("logged-in feedback links server-resolved user");
          const revision = {
            id: first.feedback.id,
            status: "RESOLVED" as const,
            note: "QA processed",
            updatedAt: first.feedback.updated_at.toISOString(),
          };
          await assert.rejects(
            processFeedback(tx, user.id, revision),
            (e) => (e as any).code === "ADMIN_REQUIRED",
          );
          await tx.user.update({
            where: { id: user.id },
            data: { isSystemAdmin: true },
          });
          await processFeedback(tx, user.id, revision);
          await assert.rejects(
            processFeedback(tx, user.id, revision),
            (e) => (e as any).code === "FEEDBACK_CHANGED",
          );
          const latest = await tx.search_feedback.findUniqueOrThrow({
            where: { id: first.feedback.id },
          });
          assert.equal(latest.status, "RESOLVED");
          assert.equal(latest.handled_by, user.id);
          await tx.user.update({
            where: { id: user.id },
            data: { isSystemAdmin: false },
          });
          await assert.rejects(
            processFeedback(tx, user.id, {
              ...revision,
              updatedAt: latest.updated_at.toISOString(),
            }),
            (e) => (e as any).code === "ADMIN_REQUIRED",
          );
          checks.push(
            "platform-only feedback processing, conflict detection and immediate revocation",
          );

          await assert.rejects(
            saveFeedback(
              tx,
              {
                ...input,
                requestId: randomUUID(),
                entryId: privateRow.unique_id,
              },
              null,
            ),
            (e) => (e as any).code === "ENTRY_UNAVAILABLE",
          );
          for (let i = 0; i < 4; i++)
            await saveFeedback(tx, { ...input, requestId: randomUUID() }, null);
          await assert.rejects(
            saveFeedback(tx, { ...input, requestId: randomUUID() }, null),
            (e) => (e as any).code === "RATE_LIMITED",
          );
          checks.push(
            "private entry association rejected, per-visitor rate limit",
          );
          const rls = await tx.$queryRaw<
            any[]
          >`SELECT relrowsecurity FROM pg_class WHERE oid='public.search_feedback'::regclass`;
          assert.equal(rls[0].relrowsecurity, true);
          checks.push("feedback RLS enabled");
          throw rollback;
        },
        { maxWait: 15000, timeout: 60000 },
      );
    } catch (e) {
      if (e !== rollback) throw e;
    }
    console.log(JSON.stringify({ checks, allQAChangesRolledBack: true }));
    // Read-only real public content performance and shape check; prints no corpus content.
    const start = performance.now();
    const { searchEntries } = await import("@/lib/search-miniprogram/service");
    const sample = await searchEntries("唔该", 20, null);
    console.log(
      JSON.stringify({
        publicSearchMs: Math.round(performance.now() - start),
        direct: sample.direct.length,
        related: sample.related.length,
        audioAvailable: sample.direct.some((e) =>
          e.senses.some((s) => !!s.audio),
        ),
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
