/** These pages authenticate in their layout/API using current database grants. */
export function isDelegatedCollectionPage(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname === "/admin/corpus-collection" ||
    /^\/admin\/corpus-collection\/(submissions|review-batches|questionnaire-insights)(\/|$)/.test(
      pathname,
    )
  );
}
/** The review webhook has its own mandatory service authentication, not a browser session. */
export function isReviewWebhook(pathname: string, method: string) {
  return (
    method === "POST" &&
    pathname === "/api/admin/corpus-collection/webhooks/reviews"
  );
}
