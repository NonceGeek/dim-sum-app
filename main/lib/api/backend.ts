function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function getBackupBackendBaseUrl() {
  const backupUrl = process.env.NEXT_PUBLIC_BACKUP_BACKEND_URL?.trim();
  if (!backupUrl) {
    throw new Error("NEXT_PUBLIC_BACKUP_BACKEND_URL is not configured");
  }
  return normalizeBaseUrl(backupUrl);
}

export function getPublicBackendUrl(path: string) {
  const baseUrl = getBackupBackendBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function backendFetch(path: string, init?: RequestInit) {
  const baseUrl = getBackupBackendBaseUrl();
  return fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, init);
}
