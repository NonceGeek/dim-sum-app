import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getOptionalMiniprogramUser } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  deviceFromUserAgent,
  ingestBatchSchema,
  isBotUserAgent,
  parseClientEvent,
  referrerHost,
} from "@/lib/analytics/events";
import { toRow } from "@/lib/analytics/server";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * Ingest for the first-party tracker. Accepts small batches (also via
 * navigator.sendBeacon), drops bots and unknown events, never stores IPs.
 * Web callers are identified by the NextAuth cookie; the miniprogram may send
 * its access token as `Authorization: Bearer <token>`. Both are optional.
 */
export async function POST(req: NextRequest) {
  const ok = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return ok;
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) return ok;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = ingestBatchSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid batch" }, { status: 400 });

  const batch = parsed.data;
  const userId = req.headers.get("authorization")
    ? ((await getOptionalMiniprogramUser(req))?.userId ?? null)
    : ((await getAuthSession().catch(() => null))?.user?.id ?? null);
  const ownHost = req.nextUrl.hostname;
  const now = Date.now();
  const rows = batch.events.flatMap((event) => {
    const props = parseClientEvent(event.name, event.props);
    if (!props) return [];
    const clientTime = event.time ? new Date(event.time) : null;
    return [
      toRow(event.name, props, {
        source: batch.source,
        client_time:
          clientTime && Math.abs(clientTime.getTime() - now) < MAX_CLOCK_SKEW_MS
            ? clientTime
            : null,
        anonymous_id: batch.anonymousId,
        session_id: batch.sessionId,
        user_id: userId,
        path: event.path ?? null,
        locale: event.locale ?? null,
        device: deviceFromUserAgent(ua),
        referrer_host: referrerHost(event.referrer, ownHost),
      }),
    ];
  });
  if (rows.length) {
    try {
      await prisma.analytics_events.createMany({ data: rows });
    } catch (error) {
      console.warn("analytics: ingest failed", error);
    }
  }
  return ok;
}
