import { AppError } from "../app-error";
import type { Prisma, PrismaClient } from "@prisma/client";
import { payload, parseName, existingItem, nameLockKey, advisoryXactLock, createTransaction } from "./common";
import { allocatePinyinSlug } from "./pinyin-slug";

const categorySelect = { id: true, name: true, parent_id: true, level: true, status: true } as const;
type Category = Prisma.content_categoriesGetPayload<{ select: typeof categorySelect }>;

export function parseParentId(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || value.length > 19) {
    throw new AppError(400, "Invalid parentId");
  }
  const id = BigInt(value);
  if (id > BigInt("9223372036854775807")) throw new AppError(400, "Invalid parentId");
  return id;
}

export function parseCategoryInput(value: unknown) {
  const body = payload(value, ["name", "parentId"]);
  return {
    name: parseName(body.name),
    parentId: body.parentId === undefined || body.parentId === null ? null : parseParentId(body.parentId),
  };
}

function categoryItem(row: Category) {
  return { id: row.id.toString(), name: row.name, parentId: row.parent_id?.toString() ?? null, level: row.level };
}

function validateParent(parent: Category | null) {
  if (!parent || parent.status !== "active") throw new AppError(404, "Parent category not found or inactive");
  if (parent.level !== 1 || parent.parent_id !== null) throw new AppError(400, "Parent must be a first-level category");
}

export async function listContentCategories(db: PrismaClient, parentId: bigint | null) {
  const rows = await db.content_categories.findMany({
    where: { parent_id: parentId, level: parentId === null ? 1 : 2, status: "active" },
    select: categorySelect, orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });
  return rows.map(categoryItem);
}

export async function createContentCategory(db: PrismaClient, input: ReturnType<typeof parseCategoryInput>, creatorId: string) {
  const { name, parentId } = input;
  const lock = nameLockKey("category", name, parentId);
  return createTransaction(db, async (tx) => {
    await advisoryXactLock(tx, lock);
    if (parentId !== null) {
      const parents = await tx.$queryRaw<Category[]>`
        SELECT id, name, parent_id, level, status FROM content_categories WHERE id = ${parentId} FOR SHARE`;
      validateParent(parents[0] ?? null);
    }
    const existing = existingItem(await tx.content_categories.findMany({
      where: { parent_id: parentId, name }, select: categorySelect, take: 2,
    }));
    if (existing) {
      if (existing.level !== (parentId === null ? 1 : 2)) throw new AppError(409, "Existing category has an invalid level");
      return { item: categoryItem(existing), created: false };
    }
    const { id, slug } = await allocatePinyinSlug(tx, "content_categories", name);
    // id is GENERATED ALWAYS; the pre-reserved sequence value needs OVERRIDING SYSTEM VALUE.
    const [row] = await tx.$queryRaw<Category[]>`
      INSERT INTO content_categories (id, name, parent_id, level, slug, status, created_by) OVERRIDING SYSTEM VALUE
      VALUES (${id}, ${name}, ${parentId}, ${parentId === null ? 1 : 2}, ${slug}, 'active', ${creatorId})
      RETURNING id, name, parent_id, level, status`;
    return { item: categoryItem(row), created: true };
  });
}
