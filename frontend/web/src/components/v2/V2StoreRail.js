'use client';

import React from 'react';
import Image from 'next/image';

const STORES = [
  { id: 'all', name: 'All Stores', icon: '🏪', bg: 'bg-slate-100 text-slate-800' },
  { id: 'amazon', name: 'Amazon India', logo: '/stores/amazon.png', tag: 'Prime', accent: 'hover:border-orange-500' },
  { id: 'flipkart', name: 'Flipkart', logo: '/stores/flipkart.png', tag: 'Assured', accent: 'hover:border-blue-500' },
  { id: 'myntra', name: 'Myntra', logo: '/stores/myntra.png', tag: 'Fashion Loot', accent: 'hover:border-pink-500' },
  { id: 'nykaa', name: 'Nykaa', logo: '/stores/nykaa.png', tag: 'Beauty', accent: 'hover:border-rose-500' },
  { id: 'ajio', name: 'Ajio', logo: '/stores/ajio.png', tag: 'Trends', accent: 'hover:border-amber-500' },
  { id: 'meesho', name: 'Meesho', logo: '/stores/meesho.png', tag: 'Budget', accent: 'hover:border-purple-500' },
  { id: 'croma', name: 'Croma', logo: '/stores/croma.png', tag: 'Electronics', accent: 'hover:border-teal-500' },
];

export default function V2StoreRail({ activeMerchant = 'all', onSelectMerchant }) {
  return (
    <div className="w-full border-b border-slate-100 bg-white py-4">
      <div className="mx-auto flex w-full max-w-[1720px] 2xl:max-w-[1840px] items-center gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8 xl:px-12 scrollbar-none">
        <span className="shrink-0 text-xs font-black uppercase tracking-wider text-slate-400">
          Tracked Stores:
        </span>
        <div className="flex items-center gap-2">
          {STORES.map((store) => {
            const isSelected = activeMerchant === store.id;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => onSelectMerchant?.(store.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? 'border-brand bg-orange-50/80 text-brand shadow-2xs ring-2 ring-brand/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ' + (store.accent || '')
                }`}
              >
                {store.icon ? (
                  <span className="text-sm">{store.icon}</span>
                ) : (
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    {/* Fallback store initials if image isn't available */}
                    <span className="text-[10px] font-black uppercase text-slate-600">
                      {store.name.slice(0, 2)}
                    </span>
                  </span>
                )}
                <span>{store.name}</span>
                {store.tag && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      isSelected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {store.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
