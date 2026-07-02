import { Skeleton } from '@/components/ui/skeleton';
import { isNativeApp } from '@/lib/platform';

/**
 * Loading skeletons for the printed-services browse funnel.
 *
 * Each one mirrors the real grid/list of its page (columns, gaps, card shape,
 * native list vs. web grid) so the layout doesn't jump when the data arrives —
 * replacing the old bare "جاري التحميل…" text spinners.
 */

/** Centered page title + subtitle placeholder shared by the catalog pages. */
export function PageHeaderSkeleton({ className = 'mb-8' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Skeleton className="h-8 w-56 mb-3" />
      <Skeleton className="h-4 w-72 max-w-[80%]" />
    </div>
  );
}

/** Category picker (ServiceSelection): icon + label. Native list / web grid. */
export function CategoryGridSkeleton({ count = 6 }: { count?: number }) {
  if (isNativeApp) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-card border border-border/60">
            <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-fr gap-5 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-full flex flex-col items-center justify-center bg-card rounded-2xl p-6 sm:p-8 shadow-card border border-border/60">
          <Skeleton className="w-20 h-20 rounded-2xl mb-5" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Sub-service picker (SubServiceSelection): icon + label + price + lead-time. */
export function SubServiceGridSkeleton({ count = 6 }: { count?: number }) {
  if (isNativeApp) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-card border border-border/60">
            <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-fr gap-5 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-full flex flex-col items-center justify-center bg-card rounded-2xl p-6 sm:p-8 shadow-card border border-border/60">
          <Skeleton className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl mb-5" />
          <Skeleton className="h-5 w-24 mb-3" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Template grid (TemplateSelection): square preview + price + code. */
export function TemplateGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-border/60 shadow-card">
          <Skeleton className="w-full rounded-none" style={{ aspectRatio: '1/1' }} />
          <div className="p-3 sm:p-4 bg-card space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
