"use client";

import { useEffect } from "react";
import {
  isRecoverableClientError,
  scheduleClearClientErrorReloadGuard,
  tryClientErrorReload,
} from "@/lib/client-error-recovery";

/**
 * Listens for unhandled client errors and reloads once to recover from
 * transient failures (e.g. stale chunks after deploy, flaky hydration).
 */
export function ClientErrorRecovery() {
  useEffect(() => {
    scheduleClearClientErrorReloadGuard();

    const onError = (event: ErrorEvent) => {
      const error = event.error ?? event.message;
      if (!isRecoverableClientError(error)) return;
      if (tryClientErrorReload(String(error))) {
        event.preventDefault();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isRecoverableClientError(event.reason)) return;
      if (tryClientErrorReload(String(event.reason))) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
