import { AppError } from "../app-error";
import type { Prisma, PrismaClient } from "@prisma/client";
import { MAX_GLOSS_LENGTH, payload, parseName, existingItem, nameLockKey, advisoryXactLock, createTransaction } from "./common";
import { allocatePinyinSlug } from "./pinyin-slug";

const tagSelect = { id: true, name: true, slug: true, facet: true, status: true } as const;
type Tag = Prisma.tagsGetPayload<{ select: typeof tagSelect }>;

export function parseTagInput(value: unknown) {
  const body = payload(value, ["name", "gloss"]);
  if (body.gloss != null && (typeof body.gloss !== "string" || body.gloss.includes("\0"))) {
    throw new AppError(400, "gloss must be a string");
  }
  const gloss = (body.gloss as string | null | undefined)?.trim() || null;
  if (gloss && gloss.length > MAX_GLOSS_LENGTH) throw new AppError(400, `gloss must be at most ${MAX_GLOSS_LENGTH} characters`);
  return { name: parseName(body.name), gloss };
}

function tagItem(row: Tag) {
  return { id: row.id.toString(), name: row.name, slug: row.slug, facet: row.facet };
}

export async function listTags(db: PrismaClient, query: string) {
  const q = query.trim();
  if (q.includes("\0")) throw new AppError(400, "Invalid q");
  // Escape LIKE metacharacters so "contains" means a literal substring.
  const escaped = q.replace(/[\\%_]/g, "\\$&");
  const rows = await db.tags.findMany({
    where: { status: "active", ...(q ? { name: { contains: escaped, mode: "insensitive" as const } } : {}) },
    select: tagSelect, orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });
  return rows.map(tagItem);
}

export async function createTag(db: PrismaClient, input: ReturnType<typeof parseTagInput>) {
  const lock = nameLockKey("tag", input.name);
  return createTransaction(db, async (tx) => {
    await advisoryXactLock(tx, lock);
    const existing = existingItem(await tx.tags.findMany({ where: { name: input.name }, select: tagSelect, take: 2 }));
    if (existing) return { item: tagItem(existing), created: false };
    const { id, slug } = await allocatePinyinSlug(tx, "tags", input.name);
    const row = await tx.tags.create({
      data: { ...input, id, slug, facet: "other", status: "active" }, select: tagSelect,
    });
    return { item: tagItem(row), created: true };
  });
}
