import { COLLECTION_ROLES, validActions } from "@/lib/collection-permissions";
/** #479 roles were capability presets, not authority to administer an activity. */
export function legacyActivityGrant(
  role: { active: boolean; role_code: string } | undefined,
  actions: unknown,
) {
  const valid = validActions(actions);
  if (
    !role?.active ||
    !COLLECTION_ROLES.includes(role.role_code as never) ||
    !valid.includes("view")
  )
    return null;
  return { role: "OPERATOR" as const, actions: valid };
}
