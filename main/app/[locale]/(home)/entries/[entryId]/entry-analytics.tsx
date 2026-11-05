"use client";

import { useEffect, useRef } from "react";
import { newAnalyticsId, track } from "@/lib/analytics/client";
import { DEFAULT_SHARE_CHANNEL } from "@/lib/analytics/events";


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
  const reportedOpens = useRef(new Set<string>());
  useEffect(() => {
    const key = `${entryId}|${shareId ?? ""}`;
    if (reportedOpens.current.has(key)) return;
    reportedOpens.current.add(key);
    const validShareId = shareId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shareId) ? shareId : undefined;
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
