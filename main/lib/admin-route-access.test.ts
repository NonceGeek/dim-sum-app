import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import proxy from "../proxy";
import { POST as reviewWebhook } from "../app/api/admin/corpus-collection/webhooks/reviews/route";

const secret = "isolated-proxy-test-secret-not-a-real-credential";
process.env.NEXTAUTH_SECRET = secret;
async function request(
  path: string,
  authenticated = true,
  headers: Record<string, string> = {},
) {
  const token = authenticated
    ? await encode({
        token: { id: "test-operator", role: "LEARNER", isSystemAdmin: false },
        secret,
      })
    : "";
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      ...headers,
      cookie: [token && `next-auth.session-token=${token}`, headers.cookie]
        .filter(Boolean)
        .join("; "),
    },
  });
}
test("delegated collection pages reach their database authorization instead of rejecting the role at proxy", async () => {
  for (const path of [
    "/admin",
    "/admin/corpus-collection/submissions",
    "/admin/corpus-collection/submissions/1",
    "/en/admin/corpus-collection/review-batches",
    "/admin/corpus-collection/questionnaire-insights",
    "/admin/contribution-applications",
    "/en/admin/ingestion-leads",
    "/admin/dataset-contact-requests",
  ]) {
    const res = await proxy(await request(path));
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("location"), null, path);
  }
});
test("delegation does not allow unrelated admin pages or prefix lookalikes", async () => {
  for (const path of [
    "/admin/users",
    "/admin/corpus-collection/activities",
    "/admin/corpus-collection/submission-permissions",
    "/admin/corpus-collection/submission-audit",
    "/admin/corpus-collection/submissions-unsafe",
  ]) {
    const res = await proxy(await request(path));
    assert.equal(res.status, 307, path);
  }
});
test("delegated routes still require login", async () => {
  const res = await proxy(
    await request("/admin/corpus-collection/submissions", false),
  );
  assert.equal(res.status, 307);
  assert.ok(res.headers.get("location")?.includes("/auth/signin"));
});
test("only the exact POST webhook skips browser login; handler still rejects missing credentials", async () => {
  const url =
    "http://localhost:3000/api/admin/corpus-collection/webhooks/reviews";
  assert.equal(
    (await proxy(new NextRequest(url, { method: "POST" }))).status,
    200,
  );
  assert.equal(
    (await reviewWebhook(new NextRequest(url, { method: "POST" }))).status,
    401,
  );
  for (const path of [
    "/api/admin/corpus-collection/webhooks/reviews/other",
    "/api/admin/corpus-collection/submissions/batch",
  ])
    assert.equal(
      (
        await proxy(
          new NextRequest(`http://localhost:3000${path}`, { method: "POST" }),
        )
      ).status,
      401,
    );
  assert.equal((await proxy(new NextRequest(url))).status, 401);
});
test("explicit Chinese switch persists a root-scoped preference and subsequent unprefixed navigation stays Chinese", async () => {
  const res = await proxy(
    await request("/zh-CN/admin/corpus-collection/submissions?q=test", true, {
      "accept-language": "en",
      cookie: "NEXT_LOCALE=en",
    }),
  );
  assert.equal(res.status, 307);
  assert.equal(
    res.headers.get("location"),
    "http://localhost:3000/admin/corpus-collection/submissions?q=test",
  );
  const cookie = res.cookies.get("NEXT_LOCALE");
  assert.equal(cookie?.value, "zh-CN");
  assert.equal(cookie?.path, "/");
  assert.equal(cookie?.maxAge, 365 * 24 * 60 * 60);
  const next = await proxy(
    await request("/admin/corpus-collection/submission-permissions", true, {
      "accept-language": "en",
      cookie: "NEXT_LOCALE=zh-CN",
    }),
  );
  // The test operator cannot enter permission administration, but locale is preserved on the redirect.
  assert.ok(!next.headers.get("location")?.includes("/en"));
  const allowed = await proxy(
    await request("/admin/corpus-collection/submissions", true, {
      "accept-language": "en",
      cookie: "NEXT_LOCALE=zh-CN",
    }),
  );
  assert.equal(allowed.status, 200);
  assert.ok(allowed.headers.get("x-middleware-rewrite")?.includes("/zh-CN/"));
});
