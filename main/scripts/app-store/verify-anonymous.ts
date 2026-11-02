// Run against the isolated local preview without the synthetic-login proxy.
import assert from "node:assert/strict";
import http from "node:http";
const origin = new URL(
  process.env.APP_STORE_TEST_ORIGIN ?? "http://localhost:3006",
);
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
) {
  throw new Error("Anonymous checks require a local HTTP preview");
}
function request(path: string, method = "GET") {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      new URL(path, origin),
      { method, headers: { Cookie: "" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.setTimeout(20_000, () =>
      req.destroy(new Error("Local preview timed out")),
    );
    req.on("error", reject);
    req.end();
  });
}
async function run() {
  const catalog = await request("/api/app-store/apps");
  assert.equal(
    catalog.status,
    200,
    "Visitors must be able to read the published catalog",
  );
  const data = JSON.parse(catalog.body);
  assert.ok(Array.isArray(data.apps));
  for (const app of data.apps) {
    assert.ok(!("draft_data" in app) && !("actor_id" in app));
  }
  for (const [path, method] of [
    ["/api/app-store/apps", "POST"],
    ["/api/app-store/apps/extra", "GET"],
    ["/api/admin/applications", "GET"],
    ["/api/user/app-favorites", "GET"],
  ]) {
    assert.equal(
      (await request(path, method)).status,
      401,
      `${method} ${path} must require authentication`,
    );
  }
  console.log(
    `PASS: anonymous catalog (${data.apps.length} apps); mutations, sibling routes, admin and favorites still require login.`,
  );
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
