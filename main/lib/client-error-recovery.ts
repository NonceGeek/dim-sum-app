const RELOAD_KEY = "dimsum:client-error-reload";
const MAX_RELOADS = 1;
const CLEAR_AFTER_MS = 8_000;

/** Clear the reload counter once the page has stayed healthy for a bit. */
export function clearClientErrorReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // sessionStorage may be unavailable (private mode / SSR)
  }
}

/**
 * Attempt a one-time full page reload after a client crash.
 * Returns true if a reload was triggered.
 */
export function tryClientErrorReload(reason?: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (count >= MAX_RELOADS) return false;

    sessionStorage.setItem(RELOAD_KEY, String(count + 1));
    if (reason) {
      console.warn("[client-error-recovery] reloading once:", reason);
    }
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function isRecoverableClientError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const name = error instanceof Error ? error.name : "";

  // Common after deployments: stale HTML referencing missing chunks
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function scheduleClearClientErrorReloadGuard(): void {
  if (typeof window === "undefined") return;
  window.setTimeout(clearClientErrorReloadGuard, CLEAR_AFTER_MS);
}
