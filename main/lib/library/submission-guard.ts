import { createHash } from "crypto";
import { NextRequest } from "next/server";

/** Hashes the client IP so throttling never stores raw addresses. */
export function clientIpHash(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET ?? ""}:library:${ip}`)
    .digest("hex");
}

/** Per-IP submissions allowed in the window; applies to each public form separately. */
export const PUBLIC_SUBMISSION_LIMIT = 5;
export const PUBLIC_SUBMISSION_WINDOW_MS = 60 * 60 * 1000;
