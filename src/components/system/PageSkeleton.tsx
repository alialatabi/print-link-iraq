/**
 * Route-transition placeholder shown as the Suspense fallback while a lazily
 * loaded page chunk downloads. Pure-Tailwind shimmer (no motion lib) so it stays
 * in the critical chunk and paints instantly. RTL-aware and theme-token based
 * (bg-muted) so it works in light and dark.
 */
const PageSkeleton = () => (
  <div
    dir="rtl"
    role="status"
    aria-label="جاري تحميل الصفحة"
    className="w-full max-w-3xl mx-auto px-4 py-8 min-h-[60vh]"
  >
    <div className="animate-pulse space-y-6" aria-hidden="true">
      {/* Header bar */}
      <div className="h-8 w-1/2 rounded-xl bg-muted" />
      <div className="h-4 w-2/3 rounded-lg bg-muted/70" />

      {/* Card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>

      {/* Text lines */}
      <div className="space-y-3 pt-4">
        <div className="h-4 w-full rounded-lg bg-muted/70" />
        <div className="h-4 w-5/6 rounded-lg bg-muted/70" />
        <div className="h-4 w-4/6 rounded-lg bg-muted/70" />
      </div>
    </div>
  </div>
);

export default PageSkeleton;
