"use client";

import { useEffect } from "react";
import { tryClientErrorReload } from "@/lib/client-error-recovery";

/**
 * Segment error boundary. Auto-reloads once on crash; falls back to a
 * friendly retry UI if the reload guard is already spent.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const reloaded = tryClientErrorReload(error.message);
    if (!reloaded) {
      console.error("[locale-error]", error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-base font-semibold text-foreground">
          页面加载遇到问题
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          正在尝试自动恢复。若页面仍异常，请手动刷新。
        </p>
        <button
          type="button"
          onClick={() => {
            if (!tryClientErrorReload("manual-reset")) {
              reset();
              window.location.reload();
            }
          }}
          className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
}
