import assert from "node:assert/strict";
import test from "node:test";
import { isEmbeddableModel3dViewerUrl } from "./model3d";

test("embeds the 帆船（哥德堡一号） viewer page", () => {
  assert.equal(
    isEmbeddableModel3dViewerUrl("https://oss.aidimsum.com/vox-ship"),
    true,
  );
});

test("does not iframe direct 3D model files", () => {
  for (const url of [
    "https://example.com/ship.glb",
    "https://example.com/ship.gltf",
    "https://example.com/ship.usdz",
  ]) {
    assert.equal(isEmbeddableModel3dViewerUrl(url), false);
  }
});
