import { z } from "zod";

// Conservative input hygiene, not a claim that these IDs exist or belong to the author.
// Keep opaque identifiers as strings (feedId may exceed JavaScript integer precision).
const identifier = z.string().trim().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/);
const channelVideoSchema = z.object({
  finderUserName: identifier,
  feedId: z.string().trim().min(1).max(1024).regex(/^(?:export\/)?[A-Za-z0-9_-]+$/),
}).strict();

export type ChannelVideo = z.infer<typeof channelVideoSchema>;

export class ChannelVideoError extends Error {
  constructor() {
    super("Invalid channelVideo: provide finderUserName and feedId as ID strings, not a URL");
  }
}

export function parseChannelVideo(value: unknown): ChannelVideo | null {
  if (value === undefined || value === null) return null;
  const result = channelVideoSchema.safeParse(value);
  if (!result.success) throw new ChannelVideoError();
  return result.data;
}

// Older clients omit this field. Only an explicit null removes an existing reference.
export function resolveChannelVideo(body: { channelVideo?: unknown }, existing: unknown) {
  return parseChannelVideo(body.channelVideo === undefined ? existing : body.channelVideo);
}
