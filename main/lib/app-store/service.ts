import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appDraftSchema,
  catalog,
  publishIssues,
  type StoreApp,
  type AppDraft,
} from "./model";

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function parseId(value: string) {
  if (!/^[1-9]\d{0,17}$/.test(value))
    throw new StoreError(400, "Invalid application ID");
  return BigInt(value);
}
export function assertWritesEnabled() {
  if (process.env.APP_STORE_WRITES_ENABLED !== "true")
    throw new StoreError(
      503,
      "App Store writes are not enabled. Complete the independent App Store schema and import first.",
    );
}
// Only the immutable public snapshot enters public responses; drafts are not selected.
const publicSelect = {
  app_id: true,
  status: true,
  published_data: true,
  published_at: true,
  updated_at: true,
} as const;
export function publicApp(profile: {
  app_id: bigint;
  status: string;
  published_data: unknown;
  published_at: Date | null;
  updated_at: Date;
}): StoreApp | null {
  if (profile.status !== "published") return null;
  const parsed = appDraftSchema.safeParse(profile.published_data);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    id: String(profile.app_id),
    publishedAt: (profile.published_at ?? profile.updated_at).toISOString(),
    updatedAt: profile.updated_at.toISOString(),
  };
}
export async function publicApps(): Promise<StoreApp[]> {
  const rows = await prisma.app_store_profiles.findMany({
    where: { status: "published" },
    select: publicSelect,
  });
  return rows.map(publicApp).filter((app): app is StoreApp => !!app);
}
export async function adminApps() {
  const rows = await prisma.app_store_profiles.findMany({
    orderBy: { app_id: "desc" },
  });
  return rows.map((row) => ({
    id: String(row.app_id),
    status: row.status,
    revision: row.revision,
    draft: appDraftSchema.parse(row.draft_data),
    hasChanges:
      JSON.stringify(row.draft_data) !== JSON.stringify(row.published_data),
    updatedAt: row.updated_at.toISOString(),
  }));
}
async function lockActiveAdmin(tx: Prisma.TransactionClient, actor: string) {
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
}

const orderSelect = { ...publicSelect, revision: true, draft_data: true };
type OrderRow = Prisma.app_store_profilesGetPayload<{ select: typeof orderSelect }>;

function appOrder(rows: OrderRow[]) {
  const items = catalog(rows.map(publicApp).filter((app): app is StoreApp => !!app));
  const version = createHash("sha256")
    .update(JSON.stringify(rows.map((row) => [String(row.app_id), row.revision])))
    .digest("hex");
  return {
    version,
    items: items.map(({ id, name }) => ({ id, name })),
  };
}

function publishedOrderRows(db: Prisma.TransactionClient) {
  return db.app_store_profiles.findMany({
    where: { status: "published" },
    orderBy: { app_id: "asc" },
    select: orderSelect,
  });
}

export async function adminAppOrder() {
  return appOrder(await publishedOrderRows(prisma));
}

export async function reorderApplications(actor: string, version: string, ids: string[]) {
  assertWritesEnabled();
  const conflict = () => new StoreError(409, "Published applications changed. Reload before sorting.");
  try {
    await prisma.$transaction(async (tx) => {
      await lockActiveAdmin(tx, actor);
      const rows = await publishedOrderRows(tx);
      const current = appOrder(rows);
      if (current.version !== version) throw conflict();

      const publicIds = new Set(current.items.map(({ id }) => id));
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== publicIds.size ||
        !ids.every((id) => publicIds.has(id))
      ) {
        throw new StoreError(400, "Order must include every visible application exactly once");
      }

      const rowsById = new Map(rows.map((row) => [String(row.app_id), row]));
      const audit: Prisma.app_store_audit_logsCreateManyInput[] = [];
      for (const [index, id] of ids.entries()) {
        const row = rowsById.get(id)!;
        const rank = index + 1;
        // Apply only the rank. Pending edits remain separate from the public snapshot.
        const draft = row.draft_data as Prisma.JsonObject;
        const published = row.published_data as Prisma.JsonObject;
        if (draft.rank === rank && published.rank === rank) continue;

        const revision = row.revision + 1;
        await tx.app_store_profiles.update({
          where: { app_id: row.app_id },
          data: {
            draft_data: { ...draft, rank },
            published_data: { ...published, rank },
            revision,
            // A display order change should not change the Recently updated sort.
            updated_at: row.updated_at,
          },
        });
        audit.push({ app_id: row.app_id, actor_id: actor, action: "reorder", revision });
      }
      if (audit.length) await tx.app_store_audit_logs.createMany({ data: audit });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
      throw conflict();
    throw error;
  }
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
    await lockActiveAdmin(tx, actor);
    let before = null;
    if (input.id) {
      const id = parseId(input.id);
      await tx.$queryRaw`SELECT app_id FROM app_store_profiles WHERE app_id = ${id} FOR UPDATE`;
      before = await tx.app_store_profiles.findUnique({
        where: { app_id: id },
      });
      if (!before) throw new StoreError(404, "Application not found");
      if (before.revision !== input.revision)
        throw new StoreError(409, "Application changed. Reload before saving.");
    } else if (input.action === "offline") {
      throw new StoreError(400, "Cannot take a new draft offline");
    }
    const status =
      input.action === "publish"
        ? "published"
        : input.action === "offline"
          ? "offline"
          : (before?.status ?? "draft");
    const revision = (before?.revision ?? 0) + 1;
    const publishedData =
      input.action === "publish" ? draft : before?.published_data;
    const data = {
      status,
      revision,
      draft_data: draft,
      published_data: publishedData ?? Prisma.DbNull,
      published_at:
        before?.published_at ??
        (input.action === "publish" ? new Date() : null),
    };
    const row = before
      ? await tx.app_store_profiles.update({
          where: { app_id: before.app_id },
          data,
        })
      : await tx.app_store_profiles.create({ data });
    await tx.app_store_audit_logs.create({
      data: {
        app_id: row.app_id,
        actor_id: actor,
        action: input.action,
        revision,
      },
    });
    return { id: String(row.app_id), status, revision };
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
      app: { select: publicSelect },
    },
  });
  return rows.map((r) => ({
    id: String(r.app_id),
    savedAt: r.created_at.toISOString(),
    app: publicApp(r.app),
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
    await tx.$queryRaw`SELECT app_id FROM app_store_profiles WHERE app_id = ${appId} FOR UPDATE`;
    if (saved) {
      const row = await tx.app_store_profiles.findUnique({
        where: { app_id: appId },
        select: publicSelect,
      });
      if (!row || !publicApp(row))
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
