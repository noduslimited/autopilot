// Perf pass, 2026-09-06: shared skeleton-loading primitives, used by every
// route segment's new loading.tsx (Next.js automatically wraps a segment
// in a Suspense boundary with this as its fallback — see each loading.tsx
// for the composed shape used on that specific page). Plain divs with
// Tailwind's animate-pulse, no library — matches this project's "no
// unnecessary dependency" pattern (Session 7/8's own reasoning for PDF/ZIP
// generation) and the Design System's existing border-radius/colour tokens.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={["animate-pulse rounded-input bg-page-bg", className].join(" ")} aria-hidden="true" />;
}

export function SkeletonHeader({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-40" />
        {withSubtitle ? <Skeleton className="mt-2 h-3.5 w-56" /> : null}
      </div>
      <Skeleton className="h-8 w-28 rounded-btn" />
    </div>
  );
}

export function SkeletonMetricCards({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-border-default bg-card-bg py-3.5 px-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonListRows({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-border-default bg-card-bg p-3.5">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-badge" />
          </div>
          <Skeleton className="mt-2 h-3 w-full max-w-[220px]" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-border-default bg-card-bg p-4">
      <div className="flex gap-4 border-b border-border-default pb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}

// A generic manager-portal page: header + metric cards + a table/list body.
// Used as the default for most /(manager) route segments.
export function ManagerPageSkeleton({ metricCount = 4 }: { metricCount?: number }) {
  return (
    <div className="p-5">
      <SkeletonHeader />
      <SkeletonMetricCards count={metricCount} />
      <SkeletonTable />
    </div>
  );
}

// A simpler manager page with no metric-card row (e.g. a settings sub-page
// or a single-form screen).
export function ManagerFormPageSkeleton() {
  return (
    <div className="p-5">
      <SkeletonHeader withSubtitle={false} />
      <div className="mt-5 max-w-xl space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}

// A detail page: back link + a header card + 2-column body cards.
export function ManagerDetailPageSkeleton() {
  return (
    <div className="p-5">
      <Skeleton className="h-3.5 w-24" />
      <div className="mt-3 rounded-card border border-border-default bg-card-bg p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-5 w-56" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border-default bg-card-bg p-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <div className="rounded-card border border-border-default bg-card-bg p-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

// Mobile portals (carer/family): a header block + stacked visit-style cards.
export function MobilePageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      <div className="bg-nhs-dark-blue px-4 pt-5 pb-4">
        <Skeleton className="h-4 w-24 bg-white/20" />
        <Skeleton className="mt-2 h-3 w-40 bg-white/10" />
      </div>
      <div className="px-4 pt-4">
        <SkeletonListRows count={count} />
      </div>
    </div>
  );
}

// Centred auth card (login/register/reset-password style screens).
export function AuthCardSkeleton() {
  return (
    <div className="w-full max-w-[400px] rounded-card border border-border-default bg-card-bg p-6">
      <Skeleton className="mx-auto h-6 w-32" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full rounded-btn" />
      </div>
    </div>
  );
}
