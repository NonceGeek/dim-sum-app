// Explicitly local-only: never run these writes against a production database.
import assert from "node:assert/strict";
import { prisma } from "../../lib/prisma";
import {
  saveApplication,
  publicApps,
  setFavorite,
  favoriteApplications,
  adminApps,
} from "../../lib/app-store/service";
import { mergeApplicationFavorites } from "../../lib/app-store/merge-favorites";
import { importLegacyApplications } from "../../lib/app-store/import-legacy";
import { EMPTY_DRAFT } from "../../lib/app-store/model";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !(
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port === "55438" &&
    process.env.APP_STORE_LOCAL_TEST === "true"
  )
)
  throw new Error(
    "This test requires the isolated local App Store test database",
  );
process.env.APP_STORE_WRITES_ENABLED = "true";
const admin = "s8-test-admin",
  user = "s8-test-user",
  inactive = "s8-test-inactive";
async function run() {
  const snapshot = () =>
    prisma.cantonese_corpus_apps
      .findMany({ orderBy: { id: "asc" } })
      .then((rows) =>
        JSON.stringify(rows, (_, v) => (typeof v === "bigint" ? String(v) : v)),
      );
  const legacyBefore = await snapshot();
  await importLegacyApplications(prisma, true);
  const beforeReimport = JSON.stringify(
    await prisma.app_store_profiles.findMany({ orderBy: { app_id: "asc" } }),
    (_, v) => (typeof v === "bigint" ? String(v) : v),
  );
  assert.equal(
    (await importLegacyApplications(prisma, true)).imported,
    0,
    "import is idempotent",
  );
  assert.equal(
    JSON.stringify(
      await prisma.app_store_profiles.findMany({ orderBy: { app_id: "asc" } }),
      (_, v) => (typeof v === "bigint" ? String(v) : v),
    ),
    beforeReimport,
    "re-import preserves existing drafts and published snapshots",
  );
  // Remove the old table name for the ENTIRE lifecycle to prove runtime independence.
  await prisma.$executeRawUnsafe(
    "ALTER TABLE public.cantonese_corpus_apps RENAME TO s8_legacy_history_fixture",
  );
  try {
    assert.ok(
      (await adminApps()).length > 0,
      "admin catalog is independent of legacy table",
    );
    for (const [id, isAdmin, status] of [
      [admin, true, "ACTIVE"],
      [user, false, "ACTIVE"],
      [inactive, false, "MERGED"],
    ] as const)
      await prisma.user.upsert({
        where: { id },
        create: { id, isSystemAdmin: isAdmin, status },
        update: { isSystemAdmin: isAdmin, status },
      });
    const d = {
      ...EMPTY_DRAFT,
      name: "S8 test application",
      summary: "Learning Cantonese",
      authors: "Fixture team",
      coverUrl: "https://example.org/cover.png",
      launchUrl: "https://example.org/app",
      access: "direct" as const,
    };
    const created = await saveApplication(admin, {
      draft: d,
      action: "save",
      revision: 0,
    });
    assert.equal(
      (await publicApps()).some((a) => a.id === created.id),
      false,
      "draft hidden from public API",
    );
    assert.equal(
      (
        await prisma.$queryRaw<
          Array<{ id: bigint }>
        >`SELECT id FROM app_store_public_legacy WHERE id = ${BigInt(created.id)}`
      ).length,
      0,
      "draft hidden from old API projection",
    );
    await assert.rejects(
      () =>
        saveApplication(user, {
          id: created.id,
          revision: created.revision,
          draft: d,
          action: "publish",
        }),
      /administrator/,
    );
    const published = await saveApplication(admin, {
      id: created.id,
      revision: created.revision,
      draft: d,
      action: "publish",
    });
    assert.equal(
      (await publicApps()).find((a) => a.id === created.id)?.name,
      d.name,
    );
    const edited = await saveApplication(admin, {
      id: created.id,
      revision: published.revision,
      draft: { ...d, name: "Unpublished secret edit" },
      action: "save",
    });
    assert.equal(
      (await publicApps()).find((a) => a.id === created.id)?.name,
      d.name,
      "unpublished edit does not alter public snapshot",
    );
    await assert.rejects(
      () =>
        saveApplication(admin, {
          id: created.id,
          revision: published.revision,
          draft: d,
          action: "publish",
        }),
      /changed/,
    );
    await Promise.all([
      setFavorite(user, created.id, true),
      setFavorite(user, created.id, true),
    ]);
    assert.equal(
      (await favoriteApplications(user)).filter((a) => a.id === created.id)
        .length,
      1,
      "favorite retry is idempotent",
    );
    await assert.rejects(
      () => setFavorite(inactive, created.id, true),
      /Active account/,
    );
    await setFavorite(admin, created.id, true);
    const sourceFavorites = await prisma.app_store_favorites.findMany({
      where: { user_id: user },
    });
    await prisma.$transaction((tx) =>
      mergeApplicationFavorites(tx, user, admin, sourceFavorites),
    );
    assert.equal((await favoriteApplications(user)).length, 0);
    assert.equal(
      (await favoriteApplications(admin)).filter((a) => a.id === created.id)
        .length,
      1,
      "account merge preserves the union without duplicates",
    );
    await setFavorite(user, created.id, true);

    await saveApplication(admin, {
      id: created.id,
      revision: edited.revision,
      draft: d,
      action: "offline",
    });
    assert.equal(
      (await publicApps()).some((a) => a.id === created.id),
      false,
    );
    const saved = (await favoriteApplications(user)).find(
      (a) => a.id === created.id,
    )!;
    assert.equal(saved.app, null, "offline favorite exposes no private draft");
    assert.equal(
      (
        await prisma.$queryRaw<
          Array<{ id: bigint }>
        >`SELECT id FROM app_store_public_legacy WHERE id = ${BigInt(created.id)}`
      ).length,
      0,
    );
    await assert.rejects(
      () => setFavorite(admin, created.id, true),
      /unavailable/,
    );
    await setFavorite(user, created.id, false);
    await setFavorite(user, created.id, false);
    assert.equal(
      (await favoriteApplications(user)).some((a) => a.id === created.id),
      false,
    );
    assert.equal(
      await prisma.app_store_audit_logs.count({
        where: { app_id: BigInt(created.id) },
      }),
      4,
    );
    await prisma.app_store_audit_logs.deleteMany({
      where: { app_id: BigInt(created.id) },
    });
    await prisma.app_store_profiles.delete({
      where: { app_id: BigInt(created.id) },
    });
    console.log(
      "PASS: independent app lifecycle works without the legacy table; import is idempotent; drafts, permissions, conflicts, favorites, account merges and offline privacy pass.",
    );
  } finally {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE public.s8_legacy_history_fixture RENAME TO cantonese_corpus_apps",
    );
  }
  assert.equal(
    await snapshot(),
    legacyBefore,
    "legacy records are unchanged by the full lifecycle",
  );
}
run().finally(() => prisma.$disconnect());
