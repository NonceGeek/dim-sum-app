import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as scenes } from "../../app/api/miniprogram/yue_cube_game/question_scenes/route";
import { GET as today } from "../../app/api/miniprogram/yue_cube_game/today_progress/route";
import { GET as progress } from "../../app/api/miniprogram/yue_cube_game/player_progress/route";
import { GET as context } from "../../app/api/miniprogram/yue_cube_game/question_context/route";
import { GET as sound } from "../../app/api/miniprogram/yue_cube_game/question_sound/route";

const request = (endpoint: string, token?: string) => new NextRequest(
  `https://example.com/api/miniprogram/yue_cube_game/${endpoint}`,
  token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
);

test("scene metadata is readable without login or with an unusable token", async () => {
  for (const token of [undefined, "invalid-or-expired"]) {
    // Image scenes are configuration data; this route test does not need a database.
    const response = await scenes(request("question_scenes?mode=image", token));
    assert.equal(response.status, 200);
    const rows = await response.json();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row).sort(), ["id", "scene", "total"]);
      assert.equal(typeof row.id, "string");
      assert.equal(typeof row.scene, "string");
      assert.equal(typeof row.total, "number");
    }
  }
});

test("public scene lookup still validates its mode", async () => {
  for (const query of ["", "?mode=unknown"]) {
    const response = await scenes(request("question_scenes" + query));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Invalid mode/);
  }
});

test("question and personal progress endpoints still require login", async () => {
  for (const [name, handler] of [
    ["today_progress", today], ["player_progress", progress],
    ["question_context", context], ["question_sound", sound],
  ] as const) {
    const response = await handler(request(name));
    assert.equal(response.status, 401, name);
    assert.equal((await response.json()).error, "Missing authentication token");
  }
});
