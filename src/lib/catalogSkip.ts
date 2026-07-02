/**
 * Catalog funnel-skip logic.
 *
 * The printed-services browse is a 3-level funnel:
 *   /services (categories) → /sub-services/:parentId (sub-services) → /templates/:serviceId
 *
 * When a category has exactly ONE sub-service, the middle page is a dead
 * one-item picker. `singleSubServiceTarget` returns the id of that lone
 * sub-service so callers can jump straight to its templates, or `null` when
 * the normal picker should render (0 sub-services → empty state, 2+ → list).
 *
 * Kept as a pure function so both the pre-navigation skip (ServiceSelection
 * links straight to the templates) and the on-load redirect (SubServiceSelection
 * handles deep links to the skipped URL) share one definition — and so back-button
 * behaviour stays consistent everywhere.
 */
export function singleSubServiceTarget(
  subServices: readonly { id: string }[],
): string | null {
  return subServices.length === 1 ? subServices[0].id : null;
}
