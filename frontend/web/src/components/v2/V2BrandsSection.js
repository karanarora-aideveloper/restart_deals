'use client';

import React from 'react';

const TOP_BRANDS = [
  { id: 'apple', name: 'Apple', icon: '🍎', category: 'Phones & Tech', tag: 'Up to 25% Off' },
  { id: 'samsung', name: 'Samsung', icon: '📱', category: 'Galaxy & Tech', tag: 'Up to 45% Off' },
  { id: 'sony', name: 'Sony', icon: '🎧', category: 'ANC & Audio', tag: 'Min. 35% Off' },
  { id: 'boat', name: 'boAt', icon: '⚡', category: 'Audio & Wearables', tag: 'Up to 75% Off' },
  { id: 'oneplus', name: 'OnePlus', icon: '🔴', category: 'Mobiles & Buds', tag: 'Up to 30% Off' },
  { id: 'nike', name: 'Nike', icon: '👟', category: 'Sneakers & Sport', tag: '40% - 60% Off' },
  { id: 'puma', name: 'Puma', icon: '🐆', category: 'Motorsport & Gym', tag: '50% - 70% Off' },
  { id: 'maybelline', name: 'Maybelline', icon: '💄', category: 'Makeup & Beauty', tag: 'Up to 50% Off' },
  { id: 'asus', name: 'ASUS', icon: '💻', category: 'Gaming Laptops', tag: 'Up to 40% Off' },
  { id: 'philips', name: 'Philips', icon: '⚡', category: 'Grooming & Home', tag: 'Min. 45% Off' },
  { id: 'mamaearth', name: 'Mamaearth', icon: '🌿', category: 'Natural Skincare', tag: 'Flat 50% Off' },
  { id: 'levis', name: "Levi's", icon: '👖', category: 'Denim & Casuals', tag: '40% - 60% Off' },
];

export default function V2BrandsSection({ activeBrand = 'all', onSelectBrand }) {
  return (
    <section className="w-full border-b border-slate-200/80 bg-slate-50/50 py-10">
      <div className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600">
                Top Brand Radar
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Deals by Brands
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Find authentic price crashes on top international and Indian brands.
            </p>
          </div>

          {activeBrand !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectBrand?.('all')}
              className="self-start sm:self-auto text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <span>✕ Clear brand filter (&quot;{activeBrand}&quot;)</span>
            </button>
          )}
        </div>

        {/* Brands Scrollable / Grid Rail */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {TOP_BRANDS.map((b) => {
            const isSelected = activeBrand.toLowerCase() === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBrand?.(isSelected ? 'all' : b.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-150 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/90 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  {b.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-black text-slate-900">
                      {b.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-indigo-600">✓</span>
                    )}
                  </div>
                  <span className="block truncate text-[10.5px] font-bold text-emerald-700">
                    {b.tag}
                  </span>
                  <span className="block truncate text-[9.5px] text-slate-400 font-medium">
                    {b.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
