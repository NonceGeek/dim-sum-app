"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

const reportedOpens = new Set<string>();

/** Counts visits that arrived through a copied share link (?from=share), once per page load. */
export function ShareLinkOpenTracker({ entryId }: { entryId: string }) {
  useEffect(() => {
    if (reportedOpens.has(entryId)) return;
    reportedOpens.add(entryId);
    track("share_link_open", { entryId });
  }, [entryId]);
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
      onClick={() => track("share_card_link_click", { entryId, surface: "entry_detail" })}
    >
      {children}
    </a>
  );
}
