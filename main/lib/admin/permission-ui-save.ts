import type {
  PermissionChange,
  PermissionData,
  SaveResult,
} from "./permission-ui";

async function read(response: Response) {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "请求失败 / Request failed",
    );
  return data;
}
/** Frontend orchestration only: every change still goes through the original authenticated API. */
export async function savePermissionChanges(
  userId: string,
  changes: PermissionChange[],
  note: string,
  request: typeof fetch = fetch,
): Promise<SaveResult[]> {
  const result: SaveResult[] = [];
  for (const change of changes) {
    try {
      if (
        change.kind === "scope" &&
        change.role === "OPERATOR" &&
        change.active
      ) {
        const current: PermissionData = await request(
          `/api/admin/business-permissions?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" },
        ).then(read);
        if (
          current.grants.some(
            (g) =>
              g.scope_type === change.scopeType &&
              g.scope_id === change.scopeId &&
              g.role === "ADMIN",
          )
        ) {
          throw new Error(
            "该用户已是管理员，已包含运营权限，请勿覆盖。 / Already an admin; do not replace with operator access.",
          );
        }
      }
      await request("/api/admin/business-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...change, userId, note }),
      }).then(read);
      result.push({ change, ok: true });
    } catch (error) {
      result.push({
        change,
        ok: false,
        error:
          error instanceof Error ? error.message : "保存失败 / Save failed",
      });
    }
  }
  return result;
}
