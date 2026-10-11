import { Prisma } from "@prisma/client";
import { pinyin } from "pinyin-pro";
import { advisoryXactLock } from "./common";

export function toPinyinSlug(name: string): string {
  return pinyin(name.trim(), {
    toneType: "none",
    type: "array",
    traditional: true,
    nonZh: "consecutive",
    v: true,
  }).join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Call only after the name lookup, inside the creation transaction. Reserving
// the sequence ID lets us insert the final slug without a temporary row/slug.
export async function allocatePinyinSlug(
  tx: Prisma.TransactionClient,
  table: "content_categories" | "tags",
  name: string,
) {
  // Serialize slug allocation per table, including collisions between a base
  // slug and another request's ID suffix. Name locks alone miss homophones.
  await advisoryXactLock(tx, JSON.stringify(["slug-allocation", table]));
  const base = toPinyinSlug(name);
  const fallback = table === "tags" ? "tag" : "category";
  async function nextId() {
    const [row] = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT nextval(pg_get_serial_sequence(${table}, 'id')) AS id`;
    return row.id;
  }
  async function taken(slug: string) {
    // table is a closed, internal allowlist; names/slugs remain bound values.
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM ${Prisma.raw(table)} WHERE slug = ${slug} LIMIT 1`;
    return rows.length > 0;
  }
  let id = await nextId();
  if (base && !await taken(base)) return { id, slug: base };
  // A legacy slug can already equal base-ID. Reserve another sequence ID in
  // that case, rather than changing existing data or mistaking it for a name match.
  while (await taken(`${base || fallback}-${id}`)) id = await nextId();
  return { id, slug: `${base || fallback}-${id}` };
}
