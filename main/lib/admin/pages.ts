import {
  canCreate,
  canScope,
  hasDatasetAdmin,
  scopeIds,
  type AdminAccess,
} from "./policy";
export function canAdminPage(a: AdminAccess, path: string) {
  if (a.isPlatformAdmin)
    return !/^\/admin\/administrators(\/|$)/.test(path) || a.isSuperAdmin;
  if (path === "/admin") return true;
  if (/^\/admin\/(categories|corpus|analytics)(\/|$)/.test(path))
    return canCreate(a, "dataset") || !!scopeIds(a, "dataset")?.length;
  if (path === "/admin/business-permissions")
    return a.grants.some((g) => canScope(a, g.scopeType, g.scopeId, "manage"));
  if (
    /^\/admin\/(contribution-applications|ingestion-leads|dataset-contact-requests)(\/|$)/.test(
      path,
    )
  )
    return hasDatasetAdmin(a);
  if (
    /^\/admin\/corpus-collection\/(activities|comments|analytics|submissions|review-batches)(\/|$)/.test(
      path,
    ) ||
    path === "/admin/corpus-collection"
  )
    return canCreate(a, "activity") || !!scopeIds(a, "activity")?.length;
  if (path === "/admin/corpus-collection/questionnaire-settings")
    return !!scopeIds(a, "activity", "manage")?.length;
  return false; // insights remain separately authorized by the legacy questionnaire service
}
export function adminLanding(a: AdminAccess) {
  if (a.isPlatformAdmin) return "/admin";
  if (canCreate(a, "dataset") || scopeIds(a, "dataset")?.length)
    return "/admin/categories";
  if (canCreate(a, "activity")) return "/admin/corpus-collection/activities";
  return "/admin/corpus-collection/submissions";
}
