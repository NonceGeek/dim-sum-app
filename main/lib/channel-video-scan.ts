import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelVideo } from "./channel-video";

// A compact reference to the current binding, not a login credential.
// Fits WeChat's 32-character scene limit even for a signed 64-bit database ID.
export function createChannelScene(id: bigint, video: ChannelVideo, secret: string) {
  if (id <= BigInt(0) || id > BigInt("9223372036854775807") || !secret) throw new Error("Invalid scan configuration");
  const key = id.toString(36);
  const signature = createHmac("sha256", secret)
    .update(JSON.stringify(["channel-scan-v1", key, video.finderUserName, video.feedId]))
    .digest("base64url").slice(0, 16);
  return `${key}.${signature}`;
}

export function channelSceneId(scene: string): bigint | null {
  if (!/^[1-9a-z][0-9a-z]{0,12}\.[A-Za-z0-9_-]{16}$/.test(scene)) return null;
  let id = BigInt(0);
  for (const character of scene.split(".")[0]) id = id * BigInt(36) + BigInt(parseInt(character, 36));
  return id <= BigInt("9223372036854775807") ? id : null;
}

export function verifyChannelScene(scene: string, video: ChannelVideo, secret: string) {
  const id = channelSceneId(scene);
  if (!id) return false;
  const expected = createChannelScene(id, video, secret);
  return scene.length === expected.length && timingSafeEqual(Buffer.from(scene), Buffer.from(expected));
}
