/** Shared capability vocabulary. Roles never imply access to an activity. */
export const COLLECTION_ACTIONS = [
  "view",
  "approve",
  "reject",
  "review_needed",
  "feature",
  "home",
  "ai_review",
  "award",
  "visibility",
] as const;
export type CollectionAction = (typeof COLLECTION_ACTIONS)[number];
export const COLLECTION_ROLES = [
  "ACTIVITY_REVIEWER",
  "ACTIVITY_OPERATOR",
  "ACTIVITY_ADMIN",
] as const;
export type CollectionRole = (typeof COLLECTION_ROLES)[number];
export const ROLE_PRESETS: Record<CollectionRole, CollectionAction[]> = {
  ACTIVITY_REVIEWER: [
    "view",
    "approve",
    "reject",
    "review_needed",
    "ai_review",
  ],
  ACTIVITY_OPERATOR: ["view", "review_needed", "feature", "home", "award"],
  ACTIVITY_ADMIN: [...COLLECTION_ACTIONS],
};
export function validActions(value: unknown): CollectionAction[] {
  if (
    !Array.isArray(value) ||
    value.some((v) => !COLLECTION_ACTIONS.includes(v))
  )
    return [];
  if (value.length && !value.includes("view")) return [];
  return [...new Set(value)] as CollectionAction[];
}
export type CollectionAccess = {
  userId: string;
  role: string;
  isAdmin: boolean;
  grants: Record<string, CollectionAction[]>;
};
export function canAct(
  access: CollectionAccess,
  activityId: string | bigint | null,
  action: CollectionAction,
) {
  if (access.isAdmin) return true;
  if (
    !COLLECTION_ROLES.includes(access.role as CollectionRole) ||
    activityId === null
  )
    return false;
  const actions = validActions(access.grants[String(activityId)]);
  return actions.includes("view") && actions.includes(action);
}
export function allowedActivityIds(
  access: CollectionAccess,
  action: CollectionAction = "view",
) {
  return Object.keys(access.grants)
    .filter((id) => canAct(access, id, action))
    .map(BigInt);
}
