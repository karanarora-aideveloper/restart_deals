'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCompare } from '@/lib/useCompare';
import { extractBrandFromTitle } from '@/lib/specExtractor';

export default function CompareDock() {
  const pathname = usePathname();
  const { compareItems, removeFromCompare, clearCompare } = useCompare();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show the dock on the dedicated comparison page itself or before client mount
  if (!mounted || pathname === '/compare' || !compareItems || compareItems.length === 0) {
    return null;
  }

  const pids = compareItems.map((p) => p._id || p.productId || p.id).join(',');
  const compareUrl = `/compare?ids=${encodeURIComponent(pids)}`;

  return (
    <aside aria-label="Product comparison dock" className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-3 rounded-full border border-white/20 bg-gray-950/90 px-4 py-2.5 shadow-2xl backdrop-blur-md pointer-events-auto text-white">
        {/* Badge & Title */}
        <div className="flex items-center gap-2 pr-1 border-r border-gray-700/60">
          <span className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-black text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>
            {compareItems.length}/4
          </span>
          <span className="text-xs font-bold text-gray-200 hidden sm:inline">Compare</span>
          <button
            onClick={clearCompare}
            className="text-[11px] text-gray-400 hover:text-gray-200 underline pl-1"
          >
            Clear
          </button>
        </div>

        {/* Selected Product Slots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((index) => {
            const item = compareItems[index];
            if (item) {
              const id = String(item._id || item.productId || item.id);
              const brand = extractBrandFromTitle(item.title);

              return (
                <div key={id} className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-brand bg-white p-0.5 shadow-sm">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[9px] font-black text-gray-800">{brand.substring(0, 3)}</span>
                  )}
                  <button
                    onClick={() => removeFromCompare(id)}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 transition-transform active:scale-90"
                    title="Remove product"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={`empty-${index}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-white/5 text-gray-500"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <Link
          href={compareUrl}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black text-white shadow-sm transition-all ${
            compareItems.length >= 2
              ? 'bg-brand hover:brightness-110 active:scale-95'
              : 'bg-gray-700 opacity-75'
          }`}
        >
          <span>{compareItems.length >= 2 ? `Compare Now (${compareItems.length})` : 'Add 1 More'}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </Link>
      </div>
    </aside>
  );
}
