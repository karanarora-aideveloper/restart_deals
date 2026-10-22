'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getRecentViewedCards,
  clearClientPersonalization,
  PZN_EVENT_NAME,
} from '@/lib/personalization';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';
import { formatInr, isUsableImageUrl } from '@/lib/affiliate';

export default function V3PersonalizedRecentRail({ userProfile }) {
  const [mounted, setMounted] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [isClearing, setIsClearing] = useState(false);

  const loadItems = () => {
    const items = getRecentViewedCards();
    setRecentItems(items);
  };

  useEffect(() => {
    setMounted(true);
    loadItems();

    const handleUpdate = () => {
      loadItems();
    };

    window.addEventListener(PZN_EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(PZN_EVENT_NAME, handleUpdate);
  }, []);

  const handleClear = () => {
    setIsClearing(true);
    clearClientPersonalization();
    setRecentItems([]);
    setTimeout(() => setIsClearing(false), 500);
  };

  // If not mounted or no recent items, do not render anything (zero layout clutter)
  if (!mounted || recentItems.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-5">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 p-4 sm:p-5 shadow-xs">
        {/* Header Strip */}
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-black shadow-xs">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900">
                  Jump Back In
                </h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                  {recentItems.length} {recentItems.length === 1 ? 'Item' : 'Items'} Viewed
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Live prices &amp; drops on deals you recently inspected
              </p>
            </div>
          </div>

          <button
            onClick={handleClear}
            disabled={isClearing}
            title="Clears your local browsing history and resets personalized feed scores"
            className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            <span>{isClearing ? 'Clearing…' : 'Clear History'}</span>
          </button>
        </div>

        {/* Horizontal Carousel of Recent Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {recentItems.map((item) => {
            const hasValidImg = isUsableImageUrl(item.imageUrl);
            const dropPct = Number(item.discountPercentage) || 0;

            return (
              <Link
                key={item.id}
                href={item.href || `/product/${item.linkedProductId || item.matchedProductId || item.productId || item.id}`}
                className="group flex-shrink-0 w-[190px] sm:w-[210px] rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Store Badge & Drop Tag */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="h-4.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 flex items-center">
                      {renderStoreLogo(item.merchant || 'amazon', 'h-3 w-auto object-contain')}
                    </div>
                    {dropPct > 0 && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9.5px] font-black text-emerald-700">
                        {dropPct}% OFF
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative h-24 w-full rounded-lg bg-slate-50 p-1 flex items-center justify-center overflow-hidden mb-2">
                    {hasValidImg ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300 text-xs font-bold">
                        🛍️ ShoppersDeals
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="text-[11.5px] font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                    {item.title || 'Tracked Product'}
                  </h4>
                </div>

                {/* Price & Action */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-black text-slate-950">
                      {item.price ? formatInr(item.price) : 'Check Price'}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-[9.5px] text-slate-400 line-through">
                        {formatInr(item.originalPrice)}
                      </span>
                    )}
                  </div>

                  <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-extrabold text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    View Drop →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
