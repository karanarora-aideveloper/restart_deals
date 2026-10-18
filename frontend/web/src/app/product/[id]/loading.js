export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* 1. Breadcrumb Skeleton */}
      <div className="flex items-center gap-2 mb-4 animate-pulse">
        <div className="h-3.5 w-14 rounded-md bg-slate-200" />
        <span className="text-slate-300">/</span>
        <div className="h-3.5 w-24 rounded-md bg-slate-200" />
        <span className="text-slate-300">/</span>
        <div className="h-3.5 w-36 rounded-md bg-slate-200" />
      </div>

      {/* 2. Top Product Header Grid (Gallery + Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left: Product Gallery Skeleton */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="relative aspect-square w-full rounded-xl bg-slate-100 animate-pulse flex flex-col items-center justify-center p-6 text-slate-300">
            <svg className="h-16 w-16 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="mt-3 text-xs font-bold text-slate-400">Loading Product View…</span>
          </div>

          {/* Thumbnails row */}
          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 w-14 rounded-lg bg-slate-100 border border-slate-200/60 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Right: Product Buy Box & Live Pricing Skeleton */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          {/* Store Logo & Badges */}
          <div className="flex items-center justify-between gap-3 animate-pulse">
            <div className="h-5 w-24 rounded-md bg-slate-200" />
            <div className="h-5 w-28 rounded-full bg-emerald-50 border border-emerald-200" />
          </div>

          {/* Title Lines */}
          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-11/12 rounded-lg bg-slate-200" />
            <div className="h-6 w-3/4 rounded-lg bg-slate-200" />
          </div>

          {/* Price Box */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/70 space-y-2.5 animate-pulse">
            <div className="flex items-baseline gap-3">
              <div className="h-8 w-32 rounded-lg bg-slate-300" />
              <div className="h-4 w-20 rounded-md bg-slate-200" />
              <div className="h-4 w-16 rounded-md bg-emerald-200" />
            </div>
            <div className="h-4 w-48 rounded-md bg-slate-200" />
          </div>

          {/* Dual Action CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-pulse">
            <div className="h-12 rounded-xl bg-indigo-200" />
            <div className="h-12 rounded-xl bg-amber-100 border border-amber-200" />
          </div>

          {/* Price Barometer Skeleton */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2 animate-pulse">
            <div className="flex justify-between">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-3 w-16 rounded bg-slate-200" />
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      {/* 3. PRIMARY HERO: 90-Day Price History Chart Skeleton */}
      <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1.5 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <div className="h-5 w-48 rounded-md bg-slate-300" />
            </div>
            <div className="h-3.5 w-72 rounded-md bg-slate-200" />
          </div>

          {/* Stat chips placeholder */}
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-8 w-24 rounded-lg bg-emerald-50 border border-emerald-200" />
            <div className="h-8 w-24 rounded-lg bg-slate-100 border border-slate-200" />
            <div className="h-8 w-24 rounded-lg bg-rose-50 border border-rose-200" />
          </div>
        </div>

        {/* Chart Canvas Area with animated wave effect */}
        <div className="relative mt-5 h-72 sm:h-80 w-full rounded-xl bg-gradient-to-b from-indigo-50/30 to-slate-50/60 p-4 border border-slate-100 overflow-hidden flex flex-col justify-between">
          {/* Simulated chart horizontal grid lines */}
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="w-full border-b border-dashed border-slate-200/80" />

          {/* Center Loading Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-3xs">
            <div className="flex items-center gap-2.5 rounded-full border border-indigo-200 bg-white px-4 py-2 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="text-xs font-bold text-indigo-900 animate-pulse">
                Loading 90-Day Price History Graph…
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
