import type { BusinessRole, ScopeType, ScopeRole } from "./policy";

export type PermissionUser = {
  id: string;
  name: string | null;
  emailHint?: string | null;
  phoneHint?: string | null;
  image?: string | null;
  status?: string;
  isSystemAdmin?: boolean;
  isSuperAdmin?: boolean;
};
export type PermissionObject = {
  id: string;
  name?: string;
  nickname?: string | null;
  title?: string;
};
export type PermissionGrant = {
  scope_type: ScopeType;
  scope_id: string;
  role: ScopeRole;
  actions: string[];
};
export type PermissionData = {
  isPlatformAdmin: boolean;
  roles: { role: BusinessRole; active: boolean }[];
  grants: PermissionGrant[];
  datasets: PermissionObject[];
  activities: PermissionObject[];
  target?: PermissionUser | null;
  questionnaireGrants?:
    | {
        activity_id: string;
        can_view_insights: boolean;
        can_export_insights: boolean;
      }[]
    | null;
};
export type PermissionChange =
  | { kind: "business"; role: BusinessRole; active: boolean }
  | {
      kind: "scope";
      scopeType: ScopeType;
      scopeId: string;
      role: ScopeRole;
      active: boolean;
      actions: string[];
    };
export type SaveResult = {
  change: PermissionChange;
  ok: boolean;
  error?: string;
};
export const businessRole = (type: ScopeType): BusinessRole =>
  type === "dataset" ? "DATASET_ADMIN" : "ACTIVITY_ADMIN";
export const objectsFor = (data: PermissionData, type: ScopeType) =>
  type === "dataset" ? data.datasets : data.activities;
export const objectTitle = (object: PermissionObject) =>
  object.nickname || object.title || object.name || object.id;
export function scopeLabel(data: PermissionData, type: ScopeType, id: string) {
  const object = objectsFor(data, type).find((o) => String(o.id) === id);
  return object ? `#${id} ${objectTitle(object)}` : `#${id}`;
}
export function managementTypes(data: PermissionData): ScopeType[] {
  return (["dataset", "activity"] as const).filter(
    (type) => data.isPlatformAdmin || objectsFor(data, type).length > 0,
  );
}
export function singleSearchUser(result?: {
  users: PermissionUser[];
  hasMore?: boolean;
}): PermissionUser | null {
  return result?.users.length === 1 && result.hasMore === false
    ? result.users[0]
    : null;
}
export function isAlreadyAdmin(
  data: PermissionData,
  type: ScopeType,
  id: string,
) {
  return data.grants.some(
    (g) => g.scope_type === type && g.scope_id === id && g.role === "ADMIN",
  );
}
