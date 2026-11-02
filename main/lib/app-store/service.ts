import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appDraftSchema,
  legacyDraft,
  publishIssues,
  type StoreApp,
  type AppDraft,
  type LegacyApp,
} from "./model";

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const legacySelect = {
  id: true,
  name: true,
  description: true,
  authors: true,
  type: true,
  url: true,
  homepage_url: true,
  github_url: true,
  icon_img: true,
  example_img: true,
  wechat_micro_app: true,
  pinned: true,
  sorting: true,
  created_at: true,
  updated_at: true,
} as const;
export function parseId(value: string) {
  if (!/^[1-9]\d{0,17}$/.test(value))
    throw new StoreError(400, "Invalid application ID");
  return BigInt(value);
}
export function assertWritesEnabled() {
  if (process.env.APP_STORE_WRITES_ENABLED !== "true")
    throw new StoreError(
      503,
      "App Store writes are not enabled. Complete the schema and legacy API rollout first.",
    );
}
function missingTable(e: unknown) {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021"
  );
}
// Strict output schema: neither draft data, audit details nor actor IDs can enter public responses.
export function publicApp(
  row: LegacyApp,
  profile?: {
    status: string;
    published_data: unknown;
    published_at: Date | null;
    updated_at: Date;
  } | null,
): StoreApp | null {
  if (profile && profile.status !== "published") return null;
  const parsed = profile
    ? appDraftSchema.safeParse(profile.published_data)
    : null;
  if (profile && !parsed?.success) return null;
  return {
    ...(parsed?.success ? parsed.data : legacyDraft(row)),
    id: String(row.id),
    publishedAt: (profile?.published_at ?? row.created_at).toISOString(),
    updatedAt: (row.updated_at ?? row.created_at).toISOString(),
  };
}
export async function publicApps(): Promise<StoreApp[]> {
  // Profile query deliberately excludes draft_data. Before schema rollout the legacy catalog still works.
  try {
    const rows = await prisma.cantonese_corpus_apps.findMany({
      select: {
        ...legacySelect,
        storeProfile: {
          select: {
            status: true,
            published_data: true,
            published_at: true,
            updated_at: true,
          },
        },
      },
    });
    return rows
      .map((r) => publicApp(r, r.storeProfile))
      .filter((r): r is StoreApp => !!r);
  } catch (e) {
    if (!missingTable(e) || process.env.APP_STORE_WRITES_ENABLED === "true")
      throw e;
    return (
      await prisma.cantonese_corpus_apps.findMany({ select: legacySelect })
    ).map((r) => publicApp(r));
  }
}
export async function adminApps() {
  const rows = await prisma.cantonese_corpus_apps.findMany({
    select: { ...legacySelect, storeProfile: true },
    orderBy: { id: "desc" },
  });
  return rows.map((row) => ({
    id: String(row.id),
    status: row.storeProfile?.status ?? "published",
    revision: row.storeProfile?.revision ?? 0,
    draft: row.storeProfile
      ? appDraftSchema.parse(row.storeProfile.draft_data)
      : legacyDraft(row),
    hasChanges:
      !!row.storeProfile &&
      JSON.stringify(row.storeProfile.draft_data) !==
        JSON.stringify(row.storeProfile.published_data),
    updatedAt: (
      row.storeProfile?.updated_at ??
      row.updated_at ??
      row.created_at
    ).toISOString(),
  }));
}
export async function saveApplication(
  actor: string,
  input: {
    id?: string;
    revision: number;
    draft: AppDraft;
    action: "save" | "publish" | "offline";
  },
) {
  assertWritesEnabled();
  const draft = appDraftSchema.parse(input.draft);
  if (input.action === "publish") {
    const issues = publishIssues(draft);
    if (issues.length)
      throw new StoreError(
        400,
        `Missing or invalid publication fields: ${issues.join(", ")}`,
      );
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`;
    const admin = await tx.user.findUnique({
      where: { id: actor },
      select: { status: true, isSystemAdmin: true, isSuperAdmin: true },
    });
    if (
      admin?.status !== "ACTIVE" ||
      (!admin.isSystemAdmin && !admin.isSuperAdmin)
    )
      throw new StoreError(403, "Platform administrator required");
    let row;
    if (input.id) {
      const id = parseId(input.id);
      await tx.$queryRaw`SELECT id FROM cantonese_corpus_apps WHERE id = ${id} FOR UPDATE`;
      row = await tx.cantonese_corpus_apps.findUnique({
        where: { id },
        include: { storeProfile: true },
      });
      if (!row) throw new StoreError(404, "Application not found");
      if ((row.storeProfile?.revision ?? 0) !== input.revision)
        throw new StoreError(409, "Application changed. Reload before saving.");
    } else {
      if (input.action === "offline")
        throw new StoreError(400, "Cannot take a new draft offline");
      // Writes are rollout-gated: the legacy API must already filter draft/offline profiles.
      row = await tx.cantonese_corpus_apps.create({
        data: { name: "", description: "", authors: [] },
      });
    }
    const before = row.storeProfile;
    const status =
      input.action === "publish"
        ? "published"
        : input.action === "offline"
          ? "offline"
          : (before?.status ?? (input.id ? "published" : "draft"));
    const revision = (before?.revision ?? 0) + 1;
    // First edit of a legacy item snapshots its current public content; saves never change that content.
    const previousPublished = before
      ? before.published_data
      : input.id
        ? legacyDraft(row)
        : null;
    const publishedData =
      input.action === "publish" ? draft : previousPublished;
    await tx.app_store_profiles.upsert({
      where: { app_id: row.id },
      create: {
        app_id: row.id,
        status,
        revision,
        draft_data: draft,
        published_data: publishedData ?? Prisma.DbNull,
        published_at:
          input.action === "publish"
            ? new Date()
            : input.id
              ? row.created_at
              : null,
      },
      update: {
        status,
        revision,
        draft_data: draft,
        published_data: publishedData ?? Prisma.DbNull,
        ...(input.action === "publish" && !before?.published_at
          ? { published_at: new Date() }
          : {}),
      },
    });
    if (input.action === "publish")
      await tx.cantonese_corpus_apps.update({
        where: { id: row.id },
        data: {
          name: draft.name,
          description: draft.description || draft.summary,
          authors: draft.authors
            .split(/[,，]/)
            .map((v) => v.trim())
            .filter(Boolean),
          type: draft.category,
          url: draft.launchUrl,
          homepage_url: draft.homepageUrl,
          github_url: draft.githubUrl,
          icon_img: draft.coverUrl,
          wechat_micro_app: draft.qrUrl,
          example_img: draft.demoUrl,
          sorting: BigInt(draft.rank),
          pinned: draft.badge === "featured",
          updated_at: new Date(),
        },
      });
    await tx.app_store_audit_logs.create({
      data: { app_id: row.id, actor_id: actor, action: input.action, revision },
    });
    return { id: String(row.id), status, revision };
  });
}
export async function favoriteApplications(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (user?.status !== "ACTIVE")
    throw new StoreError(403, "Active account required");
  const rows = await prisma.app_store_favorites.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      app_id: true,
      created_at: true,
      app: {
        select: {
          ...legacySelect,
          storeProfile: {
            select: {
              status: true,
              published_data: true,
              published_at: true,
              updated_at: true,
            },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: String(r.app_id),
    savedAt: r.created_at.toISOString(),
    app: publicApp(r.app, r.app.storeProfile),
  }));
}
export async function setFavorite(userId: string, id: string, saved: boolean) {
  assertWritesEnabled();
  const appId = parseId(id);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (user?.status !== "ACTIVE")
      throw new StoreError(403, "Active account required");
    // Same row lock as publishing: availability cannot change between check and write.
    await tx.$queryRaw`SELECT id FROM cantonese_corpus_apps WHERE id = ${appId} FOR UPDATE`;
    if (saved) {
      const row = await tx.cantonese_corpus_apps.findUnique({
        where: { id: appId },
        select: {
          ...legacySelect,
          storeProfile: {
            select: {
              status: true,
              published_data: true,
              published_at: true,
              updated_at: true,
            },
          },
        },
      });
      if (!row || !publicApp(row, row.storeProfile))
        throw new StoreError(404, "Application unavailable");
      await tx.app_store_favorites.upsert({
        where: { user_id_app_id: { user_id: userId, app_id: appId } },
        create: { user_id: userId, app_id: appId },
        update: {},
      });
    } else
      await tx.app_store_favorites.deleteMany({
        where: { user_id: userId, app_id: appId },
      });
  });
}
