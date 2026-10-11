import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { generateMiniprogramToken } from "../miniprogram-jwt";
import { prisma } from "../prisma";
import * as categoryRoutes from "../../app/api/miniprogram/content-categories/route";
import * as tagRoutes from "../../app/api/miniprogram/tags/route";

const databaseMethods = [
  [prisma.user, "findUnique"],
  [prisma.content_categories, "findMany"],
  [prisma.content_categories, "create"],
  [prisma.tags, "findMany"],
  [prisma.tags, "create"],
  [prisma, "$transaction"],
] as const;
const originals = databaseMethods.map(([target, key]) => ({ target, key, method: (target as any)[key] }));
afterEach(() => {
  for (const { target, key, method } of originals) (target as any)[key] = method;
});

// Prisma delegates are proxies, so replace their methods directly and restore
// them after each test. The actual route exports and JWT verification run here.
function setupRoutes(db: PrismaClient, kind: "category" | "tag") {
  prisma.user.findUnique = db.user.findUnique;
  prisma.content_categories.findMany = db.content_categories.findMany;
  prisma.content_categories.create = db.content_categories.create;
  prisma.tags.findMany = db.tags.findMany;
  prisma.tags.create = db.tags.create;
  prisma.$transaction = db.$transaction;
  return kind === "category" ? categoryRoutes : tagRoutes;
}

process.env.NEXTAUTH_SECRET = "taxonomy-test-secret-not-for-production";

function fixture(user: any = { role: "TAGGER_PARTNER", status: "ACTIVE", isSystemAdmin: false }, failure?: Error) {
  const queriedUsers: string[] = [];
  const db: any = {
    user: { findUnique: async ({ where }: any) => { queriedUsers.push(where.id); if (failure) throw failure; return user; } },
    tags: {
      findMany: async () => { if (failure) throw failure; return []; },
      create: async ({ data }: any) => ({ id: BigInt(201), ...data }),
    },
    content_categories: {
      findMany: async () => { if (failure) throw failure; return []; },
      create: async ({ data }: any) => ({ id: BigInt(102), ...data }),
    },
    $executeRaw: async () => 1,
    $queryRaw: async (sql: TemplateStringsArray, table: string) =>
      sql.join("").includes("nextval") ? [{ id: BigInt(table === "tags" ? 201 : 102) }] : [],
    $transaction: async (fn: any) => fn(db),
  };
  return { db: db as PrismaClient, queriedUsers };
}

async function token(overrides: Record<string, unknown> = {}) {
  return generateMiniprogramToken({ userId: "authenticated-user", role: "LEARNER", isSystemAdmin: false, ...overrides });
}

function request(method: string, jwt?: string, body?: string, query = "") {
  return new NextRequest(`http://localhost/api/miniprogram/tags${query}`, {
    method, headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}, ...(body === undefined ? {} : { body }),
  });
}

for (const kind of ["category", "tag"] as const) {
  test(`${kind}: missing and invalid tokens return 401 even with debug bypass enabled`, async () => {
    const previous = process.env.SKIP_MINIPROGRAM_AUTH;
    process.env.SKIP_MINIPROGRAM_AUTH = "true";
    try {
      const { db, queriedUsers } = fixture();
      const routes = setupRoutes(db, kind);
      const expired = await generateMiniprogramToken({ userId: "authenticated-user", role: "TAGGER_PARTNER", isSystemAdmin: true }, "-1s");
      for (const jwt of [undefined, "invalid", expired]) {
        assert.equal((await routes.GET(request("GET", jwt))).status, 401);
        assert.equal((await routes.POST(request("POST", jwt, '{"name":"生活"}'))).status, 401);
      }
      assert.equal(queriedUsers.length, 0);
    } finally {
      if (previous === undefined) delete process.env.SKIP_MINIPROGRAM_AUTH;
      else process.env.SKIP_MINIPROGRAM_AUTH = previous;
    }
  });

  test(`${kind}: authenticated learners can query`, async () => {
    const routes = setupRoutes(fixture().db, kind);
    const response = await routes.GET(request("GET", await token()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
  });

  test(`${kind}: creation checks current database roles rather than JWT roles`, async () => {
    for (const user of [
      { role: "TAGGER_PARTNER", status: "ACTIVE", isSystemAdmin: false },
      { role: "TAGGER_OUTSOURCING", status: "ACTIVE", isSystemAdmin: false },
      { role: "RESEARCHER", status: "ACTIVE", isSystemAdmin: false },
      { role: "LEARNER", status: "ACTIVE", isSystemAdmin: true },
    ]) {
      const { db, queriedUsers } = fixture(user);
      const response = await setupRoutes(db, kind).POST(request("POST", await token(), '{"name":"  生活  "}'));
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.created, true);
      assert.equal(body.item.name, "生活");
      assert.deepEqual(queriedUsers, ["authenticated-user"]);
    }
    for (const user of [null,
      { role: "LEARNER", status: "ACTIVE", isSystemAdmin: false },
      ...["DELETED", "MERGED", "PENDING_DELETE"].map((status) => ({ role: "TAGGER_PARTNER", status, isSystemAdmin: true })),
    ]) {
      const response = await setupRoutes(fixture(user).db, kind).POST(request("POST", await token({ role: "TAGGER_PARTNER", isSystemAdmin: true }), '{"name":"生活"}'));
      assert.equal(response.status, 403);
    }
  });

  test(`${kind}: malformed JSON and caller-controlled fields return 400`, async () => {
    const routes = setupRoutes(fixture().db, kind);
    const jwt = await token();
    for (const body of ["{", "null", "[]", '{"name":" "}', '{"name":"生活","userId":"admin"}', '{"name":"生活","facet":"other"}']) {
      assert.equal((await routes.POST(request("POST", jwt, body))).status, 400);
    }
  });

  test(`${kind}: database failures remain 500 rather than becoming auth errors`, async (t) => {
    t.mock.method(console, "error", () => {});
    const routes = setupRoutes(fixture(undefined, new Error("database unavailable")).db, kind);
    const jwt = await token();
    assert.equal((await routes.GET(request("GET", jwt))).status, 500);
    assert.equal((await routes.POST(request("POST", jwt, '{"name":"生活"}'))).status, 500);
  });

  test(`${kind}: duplicate and inactive responses use 200 and 409`, async () => {
    const { db } = fixture();
    const row = kind === "tag"
      ? { id: BigInt(201), name: "生活", slug: "life", facet: "other", status: "active" }
      : { id: BigInt(102), name: "生活", parent_id: null, level: 1, status: "active" };
    (db as any)[kind === "tag" ? "tags" : "content_categories"].findMany = async () => [row];
    const routes = setupRoutes(db, kind);
    const jwt = await token();
    const response = await routes.POST(request("POST", jwt, '{"name":"生活"}'));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).created, false);
    row.status = "inactive";
    assert.equal((await routes.POST(request("POST", jwt, '{"name":"生活"}'))).status, 409);
  });
}

test("category routes reject invalid IDs and missing parents on creation", async () => {
  const routes = setupRoutes(fixture().db, "category");
  const jwt = await token();
  assert.equal((await routes.GET(request("GET", jwt, undefined, "?parentId="))).status, 400);
  assert.equal((await routes.GET(request("GET", jwt, undefined, "?parentId=10"))).status, 200);
  assert.equal((await routes.POST(request("POST", jwt, '{"name":"飲食","parentId":"10"}'))).status, 404);
});
