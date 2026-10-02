'use client';

/**
 * RecentlyViewed — Fix #10
 * 
 * A lightweight localStorage-backed "Recently Viewed" rail that appears on the homepage
 * below the festive banner. When a user views a deal card (any click on the card body
 * that navigates to /product/ or /deal/), the deal is stored in localStorage under
 * 'sd_recently_viewed' (max 12 items, newest first).
 * 
 * This component reads from that store and renders a horizontal scroll rail.
 * No auth required — works for guests too.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMerchantInfo, formatInr, isUsableImageUrl } from '@/lib/affiliate';

const STORAGE_KEY = 'sd_recently_viewed';
const MAX_ITEMS = 12;

/** Call this from any card onClick to persist the deal. */
export function trackRecentlyViewed(deal) {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    let items = raw ? JSON.parse(raw) : [];
    const id = deal._id || deal.id;
    // Remove duplicate if already in list
    items = items.filter((d) => (d._id || d.id) !== id);
    // Add to front
    items.unshift({
      _id: id,
      title: deal.title,
      imageUrl: deal.imageUrl,
      dealPrice: deal.dealPrice,
      originalPrice: deal.originalPrice,
      discountPercentage: deal.discountPercentage,
      dealUrl: deal.dealUrl,
      linkedProductId: deal.linkedProductId,
      country: deal.country,
    });
    // Keep max 12
    items = items.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable (private browsing etc.) — silently ignore
  }
}

export default function RecentlyViewed() {
  const [items, setItems] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.filter((d) => isUsableImageUrl(d.imageUrl)));
      }
    } catch {
      // ignore
    }
  }, []);

  if (!mounted || items.length < 2) return null;

  return (
    <section className="mb-4" aria-label="Recently viewed deals">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <h2 className="text-[13px] font-extrabold text-[#1a1a2e]">🕒 Recently Viewed</h2>
        <button
          type="button"
          className="text-[11px] font-bold text-[#94a3b8] hover:text-[#475569] transition-colors"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setItems([]);
          }}
        >
          Clear
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((deal) => {
          const id = deal._id || deal.id;
          const href = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${id}`;
          const merchant = getMerchantInfo(deal.dealUrl || '');
          const priceStr = formatInr(deal.dealPrice, deal.country || 'IN');

          return (
            <Link
              key={id}
              href={href}
              className="group flex shrink-0 w-[130px] flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xs hover:shadow-sm hover:border-[#e0e0e0] transition-all"
            >
              {/* Image */}
              <div className="relative aspect-square w-full bg-[#fafafa] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={deal.imageUrl}
                  alt={deal.title || 'Product'}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
                {deal.discountPercentage > 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-[#1a1a1a] px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                    {deal.discountPercentage}% OFF
                  </span>
                )}
              </div>
              {/* Details */}
              <div className="p-2.5 pt-2">
                <p className="mb-1 line-clamp-2 text-[11px] font-semibold leading-tight text-[#1a1a2e]">
                  {deal.title}
                </p>
                {priceStr && (
                  <p className="text-[12px] font-extrabold text-brand">{priceStr}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
