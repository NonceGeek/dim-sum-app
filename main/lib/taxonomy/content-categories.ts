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

export function parseCategoryInclude(value: string | null) {
  if (value === null) return { datasets: false };
  if (value === "datasets") return { datasets: true };
  throw new AppError(400, "Invalid include");
}

type CategoryDataset = { name: string; nickname: string | null; corpusCount: number };

// A dataset belongs to a category when any of its corpus items is assigned to it;
// a first-level category also covers the items assigned to its active children.
export async function attachCategoryDatasets<T extends { id: string }>(db: PrismaClient, items: T[]) {
  if (items.length === 0) return [];
  const ids = items.map((item) => BigInt(item.id));
  const rows = await db.$queryRaw<{ category_id: bigint; name: string; nickname: string | null; corpus_count: number }[]>`
    SELECT t.id AS category_id, d.name, d.nickname, count(*)::int AS corpus_count
    FROM unnest(${ids}::bigint[]) AS t(id)
    JOIN content_categories cc ON (cc.id = t.id OR cc.parent_id = t.id) AND cc.status = 'active'
    JOIN corpus_category cg ON cg.category_id = cc.id
    JOIN cantonese_corpus_all c ON c.id = cg.corpus_id
    JOIN cantonese_categories d ON d.name = c.category AND d.is_public
    GROUP BY t.id, d.name, d.nickname
    ORDER BY t.id, corpus_count DESC, d.name`;
  const byCategory = new Map<string, CategoryDataset[]>();
  for (const row of rows) {
    const key = row.category_id.toString();
    const datasets = byCategory.get(key) ?? [];
    datasets.push({ name: row.name, nickname: row.nickname, corpusCount: row.corpus_count });
    byCategory.set(key, datasets);
  }
  return items.map((item) => ({ ...item, datasets: byCategory.get(item.id) ?? [] }));
}

export async function listContentCategoryTree(db: PrismaClient) {
  const rows = await db.content_categories.findMany({
    where: { level: { in: [1, 2] }, status: "active" },
    select: categorySelect, orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });
  const roots = rows
    .filter((row) => row.level === 1 && row.parent_id === null)
    .map((row) => ({ ...categoryItem(row), children: [] as ReturnType<typeof categoryItem>[] }));
  const byId = new Map(roots.map((root) => [root.id, root]));
  // Children of inactive or missing parents have no root to attach to and are dropped.
  for (const row of rows) {
    if (row.level === 2 && row.parent_id !== null) byId.get(row.parent_id.toString())?.children.push(categoryItem(row));
  }
  return roots;
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
