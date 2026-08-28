import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntryIdentity,
  type CorpusSearchRow,
} from "./entry-identity";

function buildRow(overrides: Partial<CorpusSearchRow> = {}): CorpusSearchRow {
  return {
    id: BigInt(162),
    unique_id: "9fb359b2-f561-4264-8e5e-ec899fb0cab1",
    data: "帆船（哥德堡一号）",
    note: {},
    structured_note: null,
    category: "sshzlj",
    category_display_name: "十三行资料集",
    editable_level: BigInt(1),
    lifecycle_stage: "draft",
    content_attribute: "cultural_knowledge",
    media_types: ["text", "audio", "model3d"],
    liked_num: BigInt(0),
    bookmark_num: BigInt(0),
    view_num: BigInt(0),
    created_at: new Date("2026-08-28T00:00:00.000Z"),
    updated_at: new Date("2026-08-28T00:00:00.000Z"),
    primary_category_id: null,
    primary_category_slug: null,
    primary_category_name: null,
    secondary_category_id: null,
    secondary_category_slug: null,
    secondary_category_name: null,
    ...overrides,
  };
}

test("returns content attributes and legacy voxel/audio assets for the ship entry", () => {
  const entry = buildEntryIdentity(
    buildRow({
      note: {
        context: {
          voxel: "https://oss.aidimsum.com/vox-ship",
          粤语: "https://oss.aidimsum.com/粤语.m4a",
          普通话: "https://oss.aidimsum.com/普通话.m4a",
        },
      },
    }),
  );

  assert.equal(entry.contentAttribute, "cultural_knowledge");
  assert.deepEqual(entry.mediaTypes, ["text", "audio", "model3d"]);
  assert.equal(entry.assets.audioUrl, "https://oss.aidimsum.com/粤语.m4a");
  assert.equal(entry.assets.model3dUrl, "https://oss.aidimsum.com/vox-ship");
});

test("reads numbered audio, photo_url and object-array video legacy values", () => {
  const entry = buildEntryIdentity(
    buildRow({
      media_types: ["text", "audio", "video", "image"],
      note: {
        context: {
          音频1: { link: "https://example.com/audio.m4a" },
          photo_url: [
            { url: "https://example.com/cover.jpg" },
          ],
        },
        video_clips: [{ link: "https://example.com/video.mp4" }],
      },
    }),
  );

  assert.equal(entry.assets.audioUrl, "https://example.com/audio.m4a");
  assert.equal(entry.assets.videoUrl, "https://example.com/video.mp4");
  assert.equal(entry.assets.coverImage, "https://example.com/cover.jpg");
});

test("prefers structured model3d link blocks over legacy context", () => {
  const entry = buildEntryIdentity(
    buildRow({
      structured_note: {
        data: [
          {
            blocks: [
              {
                type: "model3d",
                link: "https://example.com/model.glb",
              },
            ],
          },
        ],
      },
      note: { context: { voxel: "https://example.com/legacy-model" } },
    }),
  );

  assert.equal(entry.assets.model3dUrl, "https://example.com/model.glb");
});
