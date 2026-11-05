"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics/client";

// Module scope survives remounts (React dev double-mount, layout re-renders).
let lastTrackedPath: string | null = null;

/** Records one page_view per route change. Admin pages are excluded. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?admin(\/|$)/.test(pathname)) return;
    if (pathname === lastTrackedPath) return;
    // Only the first view of a page load is a landing; it alone carries the external referrer.
    const landing = lastTrackedPath === null;
    lastTrackedPath = pathname;
    track(
      "page_view",
      { landing },
      { referrer: landing ? document.referrer || undefined : undefined },
    );
  }, [pathname]);
  return null;
}
