import {
  COLLECTION_ACTIONS,
  validActions,
  type CollectionAction,
} from "@/lib/collection-permissions";

export const BUSINESS_ROLES = ["DATASET_ADMIN", "ACTIVITY_ADMIN"] as const;
export const SCOPE_TYPES = ["dataset", "activity"] as const;
export const SCOPE_ROLES = ["ADMIN", "OPERATOR"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];
export type ScopeType = (typeof SCOPE_TYPES)[number];
export type ScopeRole = (typeof SCOPE_ROLES)[number];
export type ScopeGrant = {
  scopeType: ScopeType;
  scopeId: string;
  role: ScopeRole;
  actions: string[];
};
export type AdminAccess = {
  userId: string;
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
  businessRoles: BusinessRole[];
  grants: ScopeGrant[];
  touchedScopes?: Array<{ type: ScopeType; id: string }>;
};
export type ScopeAction = "view" | "operate" | "manage";
export const businessRoleFor = (type: ScopeType): BusinessRole =>
  type === "dataset" ? "DATASET_ADMIN" : "ACTIVITY_ADMIN";
export function canCreate(access: AdminAccess, type: ScopeType) {
  return (
    access.isPlatformAdmin ||
    access.businessRoles.includes(businessRoleFor(type))
  );
}
export function canScope(
  access: AdminAccess,
  type: ScopeType,
  id: string | bigint | number,
  action: ScopeAction = "view",
) {
  if (access.isPlatformAdmin) return true;
  const grant = access.grants.find(
    (g) => g.scopeType === type && g.scopeId === String(id),
  );
  if (!grant) return false;
  if (grant.role === "ADMIN")
    return access.businessRoles.includes(businessRoleFor(type));
  if (action === "manage") return false;
  if (type === "dataset") return true; // dataset operations are deliberately one on/off grant
  const actions = validActions(grant.actions);
  return actions.includes("view") && (action === "view" || actions.length > 1);
}
export function canActivityAction(
  access: AdminAccess,
  id: string | bigint,
  action: CollectionAction,
) {
  if (access.isPlatformAdmin) return true;
  if (canScope(access, "activity", id, "manage")) return true;
  const grant = access.grants.find(
    (g) => g.scopeType === "activity" && g.scopeId === String(id),
  );
  return (
    grant?.role === "OPERATOR" && validActions(grant.actions).includes(action)
  );
}
export function scopeIds(
  access: AdminAccess,
  type: ScopeType,
  action: ScopeAction = "view",
): bigint[] | null {
  return access.isPlatformAdmin
    ? null
    : access.grants
        .filter(
          (g) =>
            g.scopeType === type && canScope(access, type, g.scopeId, action),
        )
        .map((g) => BigInt(g.scopeId));
}
export function canGrantScope(
  actor: AdminAccess,
  type: ScopeType,
  id: string,
  desired: ScopeRole,
  existing?: ScopeRole,
) {
  // A business admin cannot overwrite/revoke a peer admin or edit their own grant.
  return (
    actor.isPlatformAdmin ||
    (desired === "OPERATOR" &&
      existing !== "ADMIN" &&
      canScope(actor, type, id, "manage"))
  );
}
export function activityActions(
  access: AdminAccess,
  id: string,
): CollectionAction[] {
  if (access.isPlatformAdmin || canScope(access, "activity", id, "manage"))
    return [...COLLECTION_ACTIONS];
  return validActions(
    access.grants.find((g) => g.scopeType === "activity" && g.scopeId === id)
      ?.actions,
  );
}
export function hasDatasetAdmin(access: AdminAccess) {
  return (
    access.isPlatformAdmin || access.businessRoles.includes("DATASET_ADMIN")
  );
}
