'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  { id: 'all', label: 'All', color: '#FF6B00' },
  { id: 'electronics', label: 'Electronics', color: '#7c3aed' },
  { id: 'men-fashion', label: "Men's Fashion", color: '#FF6B00' },
  { id: 'women-fashion', label: "Women's Fashion", color: '#EC4899' },
  { id: 'fitness', label: 'Fitness', color: '#059669' },
  { id: 'home', label: 'Home', color: '#FFB800' },
  { id: 'beauty', label: 'Beauty', color: '#d946ef' },
  { id: 'recharge', label: 'Recharge', color: '#0284c7' },
  { id: 'books', label: 'Books', color: '#78716c' },
];

const MERCHANTS = [
  { id: 'all', label: 'All Stores', color: '#FF6B00' },
  { id: 'amazon', label: 'Amazon', color: '#FFB800', logo: '/amazon.webp' },
  { id: 'flipkart', label: 'Flipkart', color: '#2563eb', logo: '/flipkart.webp' },
  { id: 'shopsy', label: 'Shopsy', color: '#9333ea', logo: '/shopsy.webp' },
  { id: 'myntra', label: 'Myntra', color: '#FF6B00', logo: '/myntra.webp' },
  { id: 'nykaa', label: 'Nykaa', color: '#ec4899', icon: '💄' },
  { id: 'ajio', label: 'Ajio', color: '#0f172a', icon: '🕶️' },
  { id: 'meesho', label: 'Meesho', color: '#9333ea', logo: '/meesho.webp' },
  { id: 'croma', label: 'Croma', color: '#00b5b5', icon: '⚡' },
];

/**
 * Category + merchant filter pills. Reads/writes `category`/`merchant` in the URL query
 * string on the current listing route, so filtered views are real, shareable, bookmarkable
 * URLs instead of client-only tab state.
 */
export default function FilterBar({ category = 'all', merchant = 'all' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="border-b border-[#f0f0f0] bg-white px-3.5 py-2.5 md:border-b-0 md:bg-transparent md:px-0 md:py-3.5">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setParam('category', isActive && cat.id !== 'all' ? 'all' : cat.id)}
              style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
              className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide transition-all ${
                isActive ? 'text-white shadow-xs' : 'border-[#e8e8e8] bg-white text-[#555] hover:border-slate-400'
              }`}
            >
              {cat.label}
            </button>
          );
        })}

        <span className="mx-1 h-[18px] w-px shrink-0 bg-[#e8e8e8]" />

        {MERCHANTS.map((mer) => {
          const isActive = merchant === mer.id;
          return (
            <button
              key={mer.id}
              type="button"
              onClick={() => setParam('merchant', isActive && mer.id !== 'all' ? 'all' : mer.id)}
              style={
                isActive
                  ? mer.logo
                    ? { borderColor: mer.color, backgroundColor: '#ffffff', borderWidth: '2px' }
                    : { backgroundColor: mer.color, borderColor: mer.color }
                  : undefined
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 transition-all ${
                isActive
                  ? mer.logo
                    ? 'shadow-xs ring-2 ring-slate-200'
                    : 'text-white shadow-xs'
                  : 'border-[#e8e8e8] bg-white text-[#555] hover:border-slate-400'
              }`}
            >
              {mer.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mer.logo} alt={mer.label} className="h-4 w-[45px] object-contain" />
              ) : (
                <span className={`text-[11.5px] font-bold uppercase tracking-wide ${isActive ? 'text-white' : ''}`}>
                  {mer.icon ? `${mer.icon} ` : ''}{mer.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
