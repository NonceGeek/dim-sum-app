const DEFAULT_PUBLIC_BACKEND_URL = "https://backend.aidimsum.com";
const FALLBACK_STATUS_CODES = new Set([404, 500, 502, 503, 504]);

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getBackendBaseUrls() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  const backupUrl = process.env.NEXT_PUBLIC_BACKUP_BACKEND_URL?.trim();
  const urls = [configuredUrl, backupUrl, DEFAULT_PUBLIC_BACKEND_URL].filter(
    Boolean,
  ) as string[];

  return Array.from(new Set(urls.map(normalizeBaseUrl)));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function getPublicBackendUrl(path: string) {
  const [baseUrl] = getBackendBaseUrls();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function backendFetch(path: string, init?: RequestInit) {
  const backendUrls = getBackendBaseUrls();
  let lastError: unknown;
  let lastRetryableResponse: Response | undefined;

  for (const baseUrl of backendUrls) {
    try {
      const response = await fetch(
        `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
        init,
      );

      if (
        FALLBACK_STATUS_CODES.has(response.status) &&
        baseUrl !== backendUrls[backendUrls.length - 1]
      ) {
        lastRetryableResponse = response;
        console.warn(
          `Backend returned ${response.status} for ${baseUrl}; trying fallback if available.`,
        );
        continue;
      }

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      lastError = error;
      console.warn(
        `Backend request failed for ${baseUrl}; trying fallback if available.`,
        error,
      );
    }
  }

  if (lastRetryableResponse) {
    return lastRetryableResponse;
  }

  throw lastError;
}
