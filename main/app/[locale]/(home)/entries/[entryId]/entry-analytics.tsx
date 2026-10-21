"use client";

import { useEffect } from "react";
import { newAnalyticsId, track } from "@/lib/analytics/client";
import { DEFAULT_SHARE_CHANNEL } from "@/lib/analytics/events";

const reportedOpens = new Set<string>();

/**
 * Counts a visit that arrived through a share link (?from=share&sid=…), once per
 * page load. Rendered only after the entry was found, i.e. the target content loaded.
 */
export function ShareLinkOpenTracker({
  entryId,
  shareId,
}: {
  entryId: string;
  shareId?: string;
}) {
  useEffect(() => {
    const key = `${entryId}|${shareId ?? ""}`;
    if (reportedOpens.has(key)) return;
    reportedOpens.add(key);
    const validShareId = shareId && /^[0-9a-f-]{36}$/i.test(shareId) ? shareId : undefined;
    track("share_link_open", {
      entryId,
      shareId: validShareId,
      landingVisitId: newAnalyticsId(),
      // The channel can't be identified from a plain link; never guessed (#508).
      sourceChannel: DEFAULT_SHARE_CHANNEL,
    });
  }, [entryId, shareId]);
  return null;
}

/** Client wrapper so the server-rendered card link can report clicks. */
export function ShareCardLink({
  entryId,
  href,
  children,
}: {
  entryId: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        track("share_card_link_click", {
          entryId,
          shareId: newAnalyticsId(),
          surface: "entry_detail",
        })
      }
    >
      {children}
    </a>
  );
}
