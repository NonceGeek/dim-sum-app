import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/search/suggestions/route";

test("empty suggestions do not query the database and are never cached", async () => {
  for (const query of ["", "?q=%20%20", "?q=&dataset=hidden"]) {
    const response = await GET(new NextRequest(`https://example.com/api/search/suggestions${query}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { suggestions: [] });
  }
});

test("oversized input is rejected before querying the database", async () => {
  const response = await GET(new NextRequest(`https://example.com/api/search/suggestions?q=${"x".repeat(201)}`));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
