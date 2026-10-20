"use client";

import type { ClientEventName, ClientEventProps } from "./events";

/**
 * Browser tracker for the first-party analytics table (#396).
 * Fire-and-forget: events are queued, flushed in small batches, and sent with
 * sendBeacon when the page is hidden. Tracking failures never surface to users.
 */
const ENDPOINT = "/api/public/analytics/events";
const ANON_KEY = "dimsum-analytics-aid";
const SESSION_KEY = "dimsum-analytics-sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 20;

type QueuedEvent = {
  name: string;
  props: Record<string, unknown>;
  time: string;
  path: string;
  referrer?: string;
  locale?: string;
};

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let memoryIds: { anon: string; session: string } | null = null;

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

/** Storage can be blocked (private mode); fall back to per-tab memory ids. */
function ids() {
  try {
    let anon = localStorage.getItem(ANON_KEY);
    if (!anon) {
      anon = uuid();
      localStorage.setItem(ANON_KEY, anon);
    }
    const now = Date.now();
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as
      | { id: string; at: number }
      | null;
    const session =
      stored && now - stored.at < SESSION_IDLE_MS ? stored.id : uuid();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: session, at: now }));
    return { anon, session };
  } catch {
    memoryIds ??= { anon: uuid(), session: uuid() };
    return memoryIds;
  }
}

/** Routing is localePrefix "as-needed": only English carries a prefix. */
function currentLocale() {
  return /^\/en(\/|$)/.test(location.pathname) ? "en" : "zh-CN";
}

function send(events: QueuedEvent[], beacon: boolean) {
  if (!events.length) return;
  const { anon, session } = ids();
  const body = JSON.stringify({ anonymousId: anon, sessionId: session, source: "web", events });
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    // Tracking must never break the page.
  }
}

export function flush(beacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) send(queue.splice(0, MAX_BATCH), beacon);
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

export function track<N extends ClientEventName>(
  name: N,
  props: ClientEventProps<N>,
  options: { referrer?: string } = {},
) {
  if (typeof window === "undefined") return;
  listen();
  queue.push({
    name,
    props: props as Record<string, unknown>,
    time: new Date().toISOString(),
    path: location.pathname,
    referrer: options.referrer,
    locale: currentLocale(),
  });
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}
