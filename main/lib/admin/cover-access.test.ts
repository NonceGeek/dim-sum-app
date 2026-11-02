import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCoverAccess,
  generatedCoverUrl,
  readCoverImage,
} from "./cover-access";
import type { AdminAccess } from "./policy";
import { AccessError } from "./security";
const actor: AdminAccess = {
  userId: "u",
  isSuperAdmin: false,
  isPlatformAdmin: false,
  businessRoles: ["DATASET_ADMIN"],
  grants: [{ scopeType: "dataset", scopeId: "7", role: "ADMIN", actions: [] }],
};
test("cover scope validates every supplied target, not just the first valid target", async () => {
  const db: any = {
    cantonese_categories: {
      findUnique: async () => ({ id: BigInt(7), name: "owned" }),
    },
  };
  await assertCoverAccess(actor, { datasetName: "owned" }, db);
  await assert.rejects(
    assertCoverAccess(actor, { datasetName: "owned", activityId: "99" }, db),
    AccessError,
  );
  await assert.rejects(assertCoverAccess(actor, {}, db), AccessError);
  await assertCoverAccess(
    { ...actor, businessRoles: ["ACTIVITY_ADMIN"] },
    {},
    db,
  );
  await assert.rejects(
    assertCoverAccess({ ...actor, grants: [] }, { datasetName: "owned" }, db),
    AccessError,
  );
});
test("scoped cover upload cannot fetch private hosts, credentials, insecure URLs or misleading suffixes", () => {
  assert.equal(
    generatedCoverUrl(
      "https://dashscope-a717.oss-accelerate.aliyuncs.com/test.png",
    ),
    "https://dashscope-a717.oss-accelerate.aliyuncs.com/test.png",
  );
  for (const url of [
    "http://127.0.0.1/x",
    "https://127.0.0.1/x",
    "https://aliyuncs.com.evil.test/x",
    "https://a.aliyuncs.com:444/x",
    "https://u:p@a.aliyuncs.com/x",
    "file:///etc/passwd",
  ])
    assert.throws(() => generatedCoverUrl(url), AccessError);
});

test("cover downloads reject non-images and stop oversized chunked bodies", async () => {
  await assert.rejects(
    readCoverImage(
      new Response("html", { headers: { "content-type": "text/html" } }),
    ),
    AccessError,
  );
  await assert.rejects(
    readCoverImage(
      new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    ),
    AccessError,
  );
  await assert.rejects(
    readCoverImage(
      new Response(new Uint8Array(16), {
        headers: { "content-type": "image/png" },
      }),
      8,
    ),
    AccessError,
  );
  assert.equal(
    (
      await readCoverImage(
        new Response(new Uint8Array(4), {
          headers: { "content-type": "image/png" },
        }),
        8,
      )
    ).length,
    4,
  );
});
