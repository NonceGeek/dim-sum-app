import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../app-error";
import { createContentCategory, listContentCategories, parseCategoryInput, parseParentId } from "./content-categories";
import { createTag, listTags, parseTagInput } from "./tags";
import { toPinyinSlug } from "./pinyin-slug";

function database(options: { categories?: any[]; tags?: any[]; parent?: any; fail?: unknown; occupiedSlugs?: string[] } = {}) {
  const calls: Array<{ method: string; args: any }> = [];
  const record = (method: string, args: any) => { calls.push({ method, args }); };
  const slugs = {
    content_categories: new Set(options.occupiedSlugs ?? []),
    tags: new Set(options.occupiedSlugs ?? []),
  };
  const ids = { content_categories: BigInt("9007199254740993"), tags: BigInt("9007199254740995") };
  const db = {
    content_categories: {
      findMany: async (args: any) => { record("categories", args); return options.categories ?? []; },
      create: async (args: any) => {
        record("createCategory", args);
        if (options.fail) throw options.fail;
        slugs.content_categories.add(args.data.slug);
        return args.data;
      },
    },
    tags: {
      findMany: async (args: any) => { record("tags", args); return options.tags ?? []; },
      create: async (args: any) => {
        record("createTag", args);
        if (options.fail) throw options.fail;
        slugs.tags.add(args.data.slug);
        return args.data;
      },
    },
    $executeRaw: async (...args: any[]) => { record("lock", args); return 1; },
    $queryRaw: async (...args: any[]) => {
      const sql = args[0].join("?");
      if (sql.includes("nextval")) {
        record("reserveId", args);
        const table = args[1] as keyof typeof ids;
        return [{ id: ids[table]++ }];
      }
      if (sql.includes("WHERE slug")) {
        record("slugLookup", args);
        const table = args[1].sql as keyof typeof slugs;
        return slugs[table].has(args[2]) ? [{ id: BigInt(1) }] : [];
      }
      record("parentLock", args);
      return options.parent ? [options.parent] : [];
    },
    $transaction: async (fn: any, args: any) => { record("transaction", args); return fn(db); },
  };
  return { db: db as unknown as PrismaClient, calls };
}
const parent = { id: BigInt(10), name: "生活", parent_id: null, level: 1, status: "active" };
const tag = { id: BigInt(201), name: "茶樓", slug: "tea-house", facet: "scene", status: "active" };
const errorStatus = (status: number) => (error: unknown) => error instanceof AppError && error.status === status;

test("parses trimmed names, optional gloss and root parent", () => {
  assert.deepEqual(parseCategoryInput({ name: "  生活  " }), { name: "生活", parentId: null });
  assert.deepEqual(parseCategoryInput({ name: "飲食", parentId: "10" }), { name: "飲食", parentId: BigInt(10) });
  assert.deepEqual(parseTagInput({ name: " 茶樓 ", gloss: " 說明 " }), { name: "茶樓", gloss: "說明" });
  assert.equal(parseTagInput({ name: "茶樓", gloss: "  " }).gloss, null);
  assert.equal(parseTagInput({ name: "茶樓" }).gloss, null);
  assert.equal(parseTagInput({ name: "茶樓", gloss: null }).gloss, null);
  assert.equal(parseParentId("9223372036854775807"), BigInt("9223372036854775807"));
});

test("rejects malformed payloads, reserved fields and out-of-range IDs", () => {
  for (const value of [null, [], "茶樓", {}, { name: " " }, { name: 1 }, { name: "a\0b" }]) {
    assert.throws(() => parseCategoryInput(value), errorStatus(400));
    assert.throws(() => parseTagInput(value), errorStatus(400));
  }
  for (const field of ["slug", "status", "level", "userId", "operatorId", "facet"]) {
    assert.throws(() => parseCategoryInput({ name: "生活", [field]: "fake" }), errorStatus(400));
    assert.throws(() => parseTagInput({ name: "生活", [field]: "fake" }), errorStatus(400));
  }
  for (const value of [null, undefined, 10, "", "0", "-1", "01", "1.5", "1e2", " 1", "9223372036854775808"]) {
    assert.throws(() => parseParentId(value), errorStatus(400));
  }
  for (const gloss of [1, [], {}, "a\0b", "x".repeat(501)]) assert.throws(() => parseTagInput({ name: "茶樓", gloss }), errorStatus(400));
  assert.throws(() => parseCategoryInput({ name: "生".repeat(51) }), errorStatus(400));
  assert.throws(() => parseTagInput({ name: "生".repeat(51) }), errorStatus(400));
  assert.equal(parseTagInput({ name: ` ${"生".repeat(50)} `, gloss: "x".repeat(500) }).name.length, 50);
});

test("category reads filter active rows at the requested level and preserve bigint IDs", async () => {
  const { db, calls } = database({ categories: [{ ...parent, id: BigInt("9007199254740993") }] });
  const roots = await listContentCategories(db, null);
  assert.equal(roots[0].id, "9007199254740993");
  assert.equal(roots[0].parentId, null);
  assert.deepEqual(calls[0].args.where, { parent_id: null, level: 1, status: "active" });
  assert.deepEqual(calls[0].args.orderBy, [{ sort_order: "asc" }, { id: "asc" }]);
  await listContentCategories(db, BigInt(10));
  assert.deepEqual(calls.at(-1)!.args.where, { parent_id: BigInt(10), level: 2, status: "active" });
});

test("invalid parents fail creation", async () => {
  for (const [value, status] of [[null, 404], [{ ...parent, status: "inactive" }, 404], [{ ...parent, level: 2 }, 400], [{ ...parent, parent_id: BigInt(1) }, 400]] as const) {
    const { db, calls } = database({ parent: value });
    await assert.rejects(createContentCategory(db, { name: "飲食", parentId: BigInt(10) }, "creator-1"), errorStatus(status));
    assert.ok(!calls.some((call) => call.method === "createCategory"));
  }
});

test("new categories derive levels, lock parent and append ID for cross-parent slug collisions", async () => {
  const { db, calls } = database({ parent });
  const root = await createContentCategory(db, { name: "飲食", parentId: null }, "creator-1");
  const child = await createContentCategory(db, { name: "飲食", parentId: BigInt(10) }, "creator-1");
  assert.deepEqual(root, { item: { id: "9007199254740993", name: "飲食", parentId: null, level: 1 }, created: true });
  assert.equal(child.item.level, 2);
  assert.equal(child.item.parentId, "10");
  const creates = calls.filter((call) => call.method === "createCategory");
  assert.equal(creates[0].args.data.slug, "yin-shi");
  assert.equal(creates[0].args.data.created_by, "creator-1");
  assert.equal(creates[1].args.data.created_by, "creator-1");
  assert.equal(creates[1].args.data.slug, `yin-shi-${creates[1].args.data.id}`);
  const parentLock = calls.find((call) => call.method === "parentLock")!;
  assert.match(parentLock.args[0].join("?"), /FOR SHARE/);
  assert.deepEqual(calls[0].args, { isolationLevel: "ReadCommitted" });
  assert.equal(calls[1].method, "lock");
});

test("same-parent category duplicates are reused; inconsistent levels conflict", async () => {
  const { db, calls } = database({ categories: [parent] });
  assert.equal((await createContentCategory(db, { name: "生活", parentId: null }, "creator-1")).created, false);
  assert.deepEqual(calls.find((call) => call.method === "categories")!.args.where, { parent_id: null, name: "生活" });
  assert.ok(!calls.some((call) => call.method === "createCategory"));
  await assert.rejects(createContentCategory(database({ categories: [{ ...parent, level: 2 }] }).db, { name: "生活", parentId: null }, "creator-1"), errorStatus(409));
});

test("tag query trims q, filters active tags and escapes literal LIKE characters", async () => {
  const { db, calls } = database({ tags: [tag] });
  assert.deepEqual(await listTags(db, "  "), [{ id: "201", name: "茶樓", slug: "tea-house", facet: "scene" }]);
  assert.deepEqual(calls[0].args.where, { status: "active" });
  await listTags(db, "  口語  ");
  assert.deepEqual(calls[1].args.where.name, { contains: "口語", mode: "insensitive" });
  await listTags(db, "%_\\");
  assert.equal(calls[2].args.where.name.contains, "\\%\\_\\\\");
  assert.deepEqual(calls[0].args.orderBy, [{ sort_order: "asc" }, { id: "asc" }]);
  await assert.rejects(listTags(db, "\0"), errorStatus(400));
});

test("tag creation reuses cross-facet exact names without overwriting gloss or slug", async () => {
  const { db, calls } = database({ tags: [tag] });
  const result = await createTag(db, { name: "茶樓", gloss: "new gloss" }, "creator-1");
  assert.deepEqual(result, { item: { id: "201", name: "茶樓", slug: "tea-house", facet: "scene" }, created: false });
  assert.deepEqual(calls.find((call) => call.method === "tags")!.args.where, { name: "茶樓" });
  assert.ok(!calls.some((call) => call.method === "createTag"));
});

test("new tags use other and stable slugs and store gloss without exposing it", async () => {
  const { db, calls } = database();
  const result = await createTag(db, { name: "茶樓", gloss: "說明" }, "creator-1");
  const creates = calls.filter((call) => call.method === "createTag");
  assert.equal(result.created, true);
  assert.equal(result.item.id, "9007199254740995");
  assert.equal(result.item.facet, "other");
  assert.equal(creates[0].args.data.gloss, "說明");
  assert.equal(creates[0].args.data.created_by, "creator-1");
  assert.equal(result.item.slug, "cha-lou");
  assert.ok(!("gloss" in result.item));
});

test("inactive and ambiguous duplicates conflict for both vocabularies", async () => {
  for (const rows of [[{ ...tag, status: "inactive" }], [tag, tag]]) {
    await assert.rejects(createTag(database({ tags: rows }).db, { name: "茶樓", gloss: null }, "creator-1"), errorStatus(409));
  }
  for (const rows of [[{ ...parent, status: "inactive" }], [parent, parent]]) {
    await assert.rejects(createContentCategory(database({ categories: rows }).db, { name: "生活", parentId: null }, "creator-1"), errorStatus(409));
  }
});

test("unique conflicts do not retry with a different slug; other database errors propagate", async () => {
  const { db, calls } = database({ fail: { code: "P2002" } });
  await assert.rejects(createTag(db, { name: "茶樓", gloss: null }, "creator-1"), errorStatus(409));
  assert.equal(calls.filter((call) => call.method === "createTag").length, 1);
  const failure = new Error("connection failed");
  await assert.rejects(createTag(database({ fail: failure }).db, { name: "茶樓", gloss: null }, "creator-1"), (error) => error === failure);
});


test("pinyin slugs support traditional Chinese, mixed text, umlauts and punctuation", () => {
  for (const [name, expected] of [
    [" 茶樓 ", "cha-lou"], ["飲食", "yin-shi"], ["日常生活", "ri-chang-sheng-huo"],
    ["重庆", "chong-qing"], ["女兒", "nv-er"], ["Hello 世界 2026", "hello-shi-jie-2026"],
    ["Foo__BAR!!", "foo-bar"], ["!!!😀", ""],
  ]) assert.equal(toPinyinSlug(name), expected);
});

test("different homophone names create distinct tags; occupied suffixes reserve a new ID", async () => {
  const { db } = database();
  const first = await createTag(db, { name: "西安", gloss: null }, "creator-1");
  const second = await createTag(db, { name: "喜安", gloss: null }, "creator-1");
  assert.equal(first.item.slug, "xi-an");
  assert.equal(second.item.slug, `xi-an-${second.item.id}`);
  assert.equal(first.created, true);
  assert.equal(second.created, true);
  const occupied = database({ occupiedSlugs: ["xi-an", "xi-an-9007199254740995"] });
  const third = await createTag(occupied.db, { name: "喜安", gloss: null }, "creator-1");
  assert.equal(third.item.id, "9007199254740996");
  assert.equal(third.item.slug, "xi-an-9007199254740996");
});

test("different homophone category names are not treated as name duplicates", async () => {
  const { db, calls } = database();
  const first = await createContentCategory(db, { name: "西安", parentId: null }, "creator-1");
  const second = await createContentCategory(db, { name: "喜安", parentId: null }, "creator-1");
  const creates = calls.filter((call) => call.method === "createCategory");
  assert.equal(creates[0].args.data.slug, "xi-an");
  assert.equal(creates[1].args.data.slug, `xi-an-${second.item.id}`);
  assert.notEqual(first.item.id, second.item.id);
});

test("untransliterable names use resource-ID fallbacks", async () => {
  const { db, calls } = database();
  const tag = await createTag(db, { name: "!!!", gloss: null }, "creator-1");
  const category = await createContentCategory(db, { name: "😀", parentId: null }, "creator-1");
  assert.equal(tag.item.slug, `tag-${tag.item.id}`);
  assert.equal(calls.find((call) => call.method === "createCategory")!.args.data.slug, `category-${category.item.id}`);
});

test("existing names bypass slug allocation entirely, retaining historical slugs", async () => {
  const { db, calls } = database({ categories: [{ ...parent, slug: "old-category-hash" }], tags: [tag] });
  assert.equal((await createContentCategory(db, { name: parent.name, parentId: null }, "creator-1")).created, false);
  assert.equal((await createTag(db, { name: tag.name, gloss: null }, "creator-1")).item.slug, "tea-house");
  assert.ok(!calls.some((call) => ["reserveId", "slugLookup", "createCategory", "createTag"].includes(call.method)));
});
