'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, formatInr } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { isDealSaved, saveDealItem } from '@/lib/savedDeals';
import { useAuth } from '@/components/AuthProvider';
import { emitSavedChanged } from '@/lib/useSavedCount';

export default function V2DealCard({ deal, savedDeals = [], onSavedChange, onImageUnavailable }) {
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user, token } = useAuth();

  const dealId = deal._id || deal.id;
  const merchant = getMerchantInfo(deal.merchant || deal.dealUrl);
  const dealCountry = deal.country || 'IN';
  const dealPriceStr = formatInr(deal.dealPrice, dealCountry) || 'Special Price';
  const mrpStr = deal.originalPrice && deal.originalPrice > deal.dealPrice ? formatInr(deal.originalPrice, dealCountry) : null;
  
  // Real Price Drop vs MRP
  const hasRealPriceDrop = Boolean(deal.previousPrice && deal.previousPrice > (deal.dealPrice || 0));
  const realPriceDrop = hasRealPriceDrop ? deal.previousPrice - deal.dealPrice : 0;
  const discountPct = deal.discountPercentage || 
    (deal.originalPrice && deal.dealPrice ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100) : 0);

  const saved = isDealSaved(dealId, savedDeals);
  const cardHref = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${dealId}`;
  const affiliateUrl = getAffiliateUrl(deal.dealUrl, dealCountry);

  const handleToggleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaving(true);
    const authUser = user && token ? { ...user, token } : null;
    const updated = await saveDealItem(deal, authUser);
    setIsSaving(false);
    if (!saved) logEvent('add_to_wishlist', { item_id: dealId, item_name: deal.title });
    emitSavedChanged();
    onSavedChange?.(updated);
  };

  const handleBuyClick = () => {
    logEvent('click_deal', { item_id: dealId, item_name: deal.title, merchant: merchant.name });
  };

  // Merchant badge styling
  const merchantColors = {
    Amazon: 'bg-amber-500/10 text-amber-700 border-amber-300',
    Flipkart: 'bg-blue-500/10 text-blue-700 border-blue-300',
    Myntra: 'bg-pink-500/10 text-pink-700 border-pink-300',
    Nykaa: 'bg-rose-500/10 text-rose-700 border-rose-300',
    Ajio: 'bg-amber-600/10 text-amber-800 border-amber-400',
    Meesho: 'bg-purple-500/10 text-purple-700 border-purple-300',
    Croma: 'bg-teal-500/10 text-teal-700 border-teal-300',
  };
  const merchantBadgeClass = merchantColors[merchant.name] || 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg">
      <div>
        {/* Top Header Strip: Store Badge + Discount Tag + Wishlist */}
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${merchantBadgeClass}`}>
              {merchant.name}
            </span>
            {discountPct > 0 && (
              <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10.5px] font-black text-white">
                -{discountPct}%
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleSave}
            disabled={isSaving}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
              saved ? 'bg-rose-50 text-rose-500' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>

        {/* Product Image */}
        <Link href={cardHref} className="relative block h-44 sm:h-48 w-full overflow-hidden rounded-xl bg-slate-50/60 p-2">
          {deal.imageUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.imageUrl}
              alt={deal.title || 'Product'}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => {
                setImgError(true);
                onImageUnavailable?.(dealId);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
              No Image Available
            </div>
          )}

          {/* Badges on Image (ATL or Real Drop) */}
          {deal.isAllTimeLow && (
            <span className="absolute bottom-2 left-2 rounded-md bg-amber-500 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-950 shadow-xs">
              ★ All-Time Low
            </span>
          )}
          {!deal.isAllTimeLow && hasRealPriceDrop && realPriceDrop > 0 && (
            <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/90 backdrop-blur-xs px-2 py-0.5 text-[9.5px] font-bold text-white shadow-xs">
              ₹{realPriceDrop.toLocaleString('en-IN')} Price Drop
            </span>
          )}
        </Link>

        {/* Title */}
        <h3 className="mt-3 line-clamp-2 min-h-[36px] text-xs sm:text-[13px] font-bold leading-snug text-slate-900 group-hover:text-brand transition-colors">
          <Link href={cardHref}>{deal.title}</Link>
        </h3>

        {/* Ratings & Authenticity note */}
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          {deal.rating ? (
            <span className="flex items-center gap-1 text-amber-600 font-bold">
              <span>★</span>
              <span>{deal.rating}</span>
              {deal.reviewCount && <span className="text-slate-400">({deal.reviewCount})</span>}
            </span>
          ) : (
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <span>✓</span> 90-Day Verified
            </span>
          )}
          <span className="text-slate-400 text-[10px]">
            {formatRelativeTime(deal.createdAt || deal.updatedAt)}
          </span>
        </div>

        {/* Price Section */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
            {dealPriceStr}
          </span>
          {mrpStr && (
            <span className="text-xs font-semibold text-slate-400 line-through">
              {mrpStr}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Get Deal + View Graph */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBuyClick}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-brand py-2 text-xs font-black text-white shadow-2xs transition-all hover:bg-[#e05d00] hover:shadow-xs active:scale-[0.98]"
        >
          <span>Get Deal</span>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>

        <Link
          href={cardHref}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
          title="View 90-Day Price History Chart"
          aria-label="View price history chart"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
