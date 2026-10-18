export default function DealLoading() {
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

      {/* 2. Top Deal Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left: Deal Photo Skeleton */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="aspect-square w-full rounded-xl bg-slate-100 animate-pulse flex flex-col items-center justify-center p-6 text-slate-300">
            <svg className="h-16 w-16 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="mt-3 text-xs font-bold text-slate-400">Loading Deal View…</span>
          </div>
        </div>

        {/* Right: Deal Actions & Live Price Box */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-3 animate-pulse">
            <div className="h-5 w-24 rounded-md bg-slate-200" />
            <div className="h-5 w-28 rounded-full bg-emerald-50 border border-emerald-200" />
          </div>

          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-11/12 rounded-lg bg-slate-200" />
            <div className="h-6 w-3/4 rounded-lg bg-slate-200" />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/70 space-y-2.5 animate-pulse">
            <div className="flex items-baseline gap-3">
              <div className="h-8 w-32 rounded-lg bg-slate-300" />
              <div className="h-4 w-20 rounded-md bg-slate-200" />
              <div className="h-4 w-16 rounded-md bg-emerald-200" />
            </div>
            <div className="h-4 w-48 rounded-md bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-pulse">
            <div className="h-12 rounded-xl bg-indigo-200" />
            <div className="h-12 rounded-xl bg-amber-100 border border-amber-200" />
          </div>
        </div>
      </div>

      {/* 3. Price History & Deals Radar Skeleton */}
      <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="relative h-64 sm:h-72 w-full rounded-xl bg-gradient-to-b from-indigo-50/30 to-slate-50/60 p-4 border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="w-full border-b border-dashed border-slate-200/80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-3xs">
            <div className="flex items-center gap-2.5 rounded-full border border-indigo-200 bg-white px-4 py-2 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="text-xs font-bold text-indigo-900 animate-pulse">
                Loading Verified Deal Details…
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
