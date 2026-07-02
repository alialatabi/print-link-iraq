// Warms the TemplateDetails route chunk on hover/focus intent so the product page
// paints without a chunk-fetch waterfall when the link is actually clicked.
//
// It fires the SAME dynamic import App.tsx's lazy() route uses. App.tsx imports
// `./pages/customer/TemplateDetails`; the specifier below (`@/pages/customer/TemplateDetails`,
// with `@` aliased to `src` in vite/vitest config) resolves to the exact same module,
// so Vite/Rollup reuse the one route chunk — no duplicate download.

let chunkPromise: Promise<unknown> | null = null;

/**
 * Prefetch the product-detail (TemplateDetails) route chunk. Memoized: the import
 * promise is cached, so repeated pointerenter/focus events kick off the request at
 * most once. Best-effort — a failed prefetch (offline/flaky network) is swallowed and
 * the cache reset so a later intent can retry; the real click navigation still surfaces
 * any load error through the route's Suspense/error boundary.
 */
export function prefetchTemplateDetails(): void {
  if (chunkPromise) return;
  chunkPromise = import('@/pages/customer/TemplateDetails').catch(() => {
    chunkPromise = null;
  });
}
