'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, isUsableImageUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { isDealSaved, saveDealItem } from '@/lib/savedDeals';
import { useAuth } from '@/components/AuthProvider';
import { emitSavedChanged } from '@/lib/useSavedCount';
import { renderStoreLogo } from '@/components/v2/BrandAndStoreLogos';

function formatInr(val) {
  if (val === null || val === undefined || isNaN(val)) return 'Special Price';
  return `₹${Math.round(Number(val)).toLocaleString('en-IN')}`;
}

export default function V3DealCard({ deal, savedDeals = [], onSavedChange, onImageUnavailable }) {
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user, token } = useAuth();

  const dealId = deal._id || deal.id;
  const merchant = getMerchantInfo(deal.merchant || deal.dealUrl);
  const dealCountry = (deal.country || 'IN').toUpperCase();

  // Pricing Fields
  const currentPrice = Number(deal.dealPrice || 0);
  const listMrp = Number(deal.originalPrice || 0);
  const previousTrackedPrice = Number(deal.previousPrice || 0);

  // 1. MRP Discount
  const hasMrp = listMrp > currentPrice;
  const mrpSavings = hasMrp ? listMrp - currentPrice : 0;
  const mrpDiscountPct = hasMrp
    ? Math.round((mrpSavings / listMrp) * 100)
    : (deal.discountPercentage || 0);

  // 2. Genuine Price Drop
  const hasPriceDrop = previousTrackedPrice > currentPrice;
  const priceDropCash = hasPriceDrop ? previousTrackedPrice - currentPrice : 0;
  const priceDropPct = hasPriceDrop ? Math.round((priceDropCash / previousTrackedPrice) * 100) : 0;

  const saved = isDealSaved(dealId, savedDeals);
  const cardHref = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${dealId}`;
  const affiliateUrl = getAffiliateUrl(deal.dealUrl || deal.url, dealCountry);
  const verifiedTime = formatRelativeTime(deal.lastVerifiedAt || deal.updatedAt || deal.createdAt);

  const rawImage = deal.imageUrl || (Array.isArray(deal.images) && deal.images[0]) || '';
  const hasValidImage = isUsableImageUrl(rawImage) && !imgError;

  // Buyhatke Smart Verdict Calculation
  let verdictText = '👍 Verified Drop';
  let verdictBg = 'bg-blue-50 text-blue-700 border-blue-200';
  if (deal.isAllTimeLow) {
    verdictText = '🔥 Lowest in 90 Days';
    verdictBg = 'bg-amber-50 text-amber-800 border-amber-300';
  } else if (mrpDiscountPct >= 50 || priceDropPct >= 20) {
    verdictText = '✅ Steal Deal (Buy)';
    verdictBg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  } else if (hasPriceDrop) {
    verdictText = `📉 ₹${priceDropCash.toLocaleString('en-IN')} Price Drop`;
    verdictBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

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
    logEvent('click_deal', { item_id: dealId, item_name: deal.title, merchant: merchant.name, source: 'v3_card' });
  };

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl">
      <div>
        {/* Top Header: Store Logo + Wishlist */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
            {renderStoreLogo(deal.merchant || merchant.name, 'h-4 max-w-[70px] object-contain')}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{verifiedTime}</span>
            </span>

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
        </div>

        {/* Product Image Area with High-Contrast Badge */}
        <Link href={cardHref} className="relative block h-44 sm:h-52 w-full overflow-hidden rounded-xl bg-slate-50/70 p-2.5">
          {hasValidImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rawImage}
              alt={deal.title || 'Product'}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => {
                setImgError(true);
                onImageUnavailable?.(dealId);
              }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-center p-3">
              <span className="text-3xl mb-1">{merchant.emoji || '🛍️'}</span>
              <span className="text-[11px] font-bold text-slate-500">{merchant.name} Verified Deal</span>
            </div>
          )}

          {/* Top-Right Badge: Buyhatke High-Contrast Discount Pill */}
          {hasPriceDrop && priceDropPct >= 3 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-emerald-600 px-2.5 py-1 text-center shadow-md">
              <span className="block text-[11px] font-black uppercase text-white tracking-tight">
                📉 {priceDropPct}% DROP
              </span>
            </div>
          ) : mrpDiscountPct > 0 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-[#5855E5] px-2.5 py-1 text-center shadow-md">
              <span className="block text-[11px] font-black uppercase text-white tracking-tight">
                {mrpDiscountPct}% OFF
              </span>
            </div>
          ) : null}
        </Link>

        {/* Product Title */}
        <h3 className="mt-3 line-clamp-2 min-h-[36px] text-xs sm:text-[13px] font-bold leading-snug text-slate-900 group-hover:text-indigo-600 transition-colors">
          <Link href={cardHref}>{deal.title || 'Special Promotion Deal'}</Link>
        </h3>

        {/* Buyhatke Smart Verdict Pill */}
        <div className="mt-2.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${verdictBg}`}>
            {verdictText}
          </span>
        </div>

        {/* Pricing Block */}
        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
            {formatInr(currentPrice)}
          </span>
          {hasMrp && (
            <span className="text-xs font-bold text-slate-400 line-through">
              {formatInr(listMrp)}
            </span>
          )}
          {mrpSavings > 0 && (
            <span className="text-[11px] font-extrabold text-emerald-600">
              Save ₹{mrpSavings.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Mini Sparkline Price Trend (Buyhatke Feature) */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span>{hasPriceDrop ? `Previous: ${formatInr(previousTrackedPrice)}` : 'Historical Low Price'}</span>
          </span>
          <span className="text-indigo-600 font-bold">Price Tracked</span>
        </div>
      </div>

      {/* Dual Actions (Buyhatke Exact Layout): Buy Now + View Price Graph */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBuyClick}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#5855E5] py-2.5 text-xs font-black text-white shadow-xs transition-all hover:bg-[#4743DE] hover:shadow-md active:scale-[0.98]"
        >
          <span>⚡ BUY NOW</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>

        <Link
          href={cardHref}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[11px] font-extrabold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 shadow-2xs"
          title="View 90-day price history graph"
        >
          <svg className="h-3.5 w-3.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="hidden sm:inline">Price Graph</span>
        </Link>
      </div>
    </article>
  );
}
