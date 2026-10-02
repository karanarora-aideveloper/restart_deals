'use client';

import React from 'react';

const DISCOUNT_BANDS = [
  { id: 0, label: 'All Verified Drops', icon: '⚡' },
  { id: 40, label: 'Min. 40% Off', icon: '🔥' },
  { id: 50, label: 'Min. 50% Off', icon: '💥' },
  { id: 60, label: 'Min. 60% Off', icon: '🎯' },
  { id: 70, label: '70%+ Mega Loot', icon: '💎' },
];

export default function V2DiscountBands({
  activeMinDiscount = 0,
  onSelectDiscount,
  dealCount = 0,
  activeSort = 'newest',
  onSelectSort,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/60 bg-white py-3.5">
      {/* Left: Discount Bands */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="shrink-0 text-xs font-black uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
          Filter:
        </span>
        {DISCOUNT_BANDS.map((band) => {
          const isSelected = activeMinDiscount === band.id;
          return (
            <button
              key={band.id}
              type="button"
              onClick={() => onSelectDiscount?.(band.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <span>{band.icon}</span>
              <span>{band.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Deal counter & Sort */}
      <div className="flex shrink-0 items-center justify-between sm:justify-end gap-3 text-xs">
        <span className="font-bold text-slate-500">
          Showing <span className="font-black text-slate-900">{dealCount}</span> live drops
        </span>

        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
          <span className="text-slate-400 font-semibold">Sort:</span>
          <select
            value={activeSort}
            onChange={(e) => onSelectSort?.(e.target.value)}
            className="rounded-lg bg-slate-50 px-2.5 py-1 font-bold text-slate-800 outline-none hover:bg-slate-100"
          >
            <option value="newest">Latest Drops</option>
            <option value="discount">Highest Discount %</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>
    </div>
  );
}
