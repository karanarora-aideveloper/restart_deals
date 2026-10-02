'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, isUsableImageUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { isDealSaved, saveDealItem } from '@/lib/savedDeals';
import { useAuth } from '@/components/AuthProvider';
import { emitSavedChanged } from '@/lib/useSavedCount';
import { renderStoreLogo } from './BrandAndStoreLogos';

function formatInr(val) {
  if (val === null || val === undefined || isNaN(val)) return 'Special Price';
  return `₹${Math.round(Number(val)).toLocaleString('en-IN')}`;
}

export default function V2DealCard({ deal, savedDeals = [], onSavedChange, onImageUnavailable }) {
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

  // 1. MRP Discount (Printed list MRP discount)
  const hasMrp = listMrp > currentPrice;
  const mrpSavings = hasMrp ? listMrp - currentPrice : 0;
  const mrpDiscountPct = hasMrp
    ? Math.round((mrpSavings / listMrp) * 100)
    : (deal.discountPercentage || 0);

  // 2. Genuine Price Drop (Against our engine's last recorded selling price)
  const hasPriceDrop = previousTrackedPrice > currentPrice;
  const priceDropCash = hasPriceDrop ? previousTrackedPrice - currentPrice : 0;
  const priceDropPct = hasPriceDrop ? Math.round((priceDropCash / previousTrackedPrice) * 100) : 0;

  const saved = isDealSaved(dealId, savedDeals);
  const cardHref = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${dealId}`;
  const affiliateUrl = getAffiliateUrl(deal.dealUrl || deal.url, dealCountry);

  // Deal Age & Verification Timestamp
  const verifiedTime = formatRelativeTime(deal.lastVerifiedAt || deal.updatedAt || deal.createdAt);

  // Safe Image URL
  const rawImage = deal.imageUrl || (Array.isArray(deal.images) && deal.images[0]) || '';
  const hasValidImage = isUsableImageUrl(rawImage) && !imgError;

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

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl">
      <div>
        {/* Top Header: Official Store Logo + Verification Status + Wishlist */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {/* Official Store Logo */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1">
            {renderStoreLogo(deal.merchant || merchant.name, 'h-4 max-w-[70px] object-contain')}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Live Verification Badge */}
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[9.5px] font-bold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{verifiedTime}</span>
            </span>

            {/* Wishlist Button */}
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

        {/* Product Image Area with High-Contrast Badges */}
        <Link href={cardHref} className="relative block h-44 sm:h-52 w-full overflow-hidden rounded-xl bg-slate-50 p-2.5">
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

          {/* High-Contrast Badge Top-Right: True Price Drop OR MRP Discount */}
          {hasPriceDrop && priceDropPct >= 3 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2.5 py-1 text-center shadow-md">
              <span className="block text-[11px] font-black uppercase text-white tracking-tight">
                📉 {priceDropPct}% PRICE DROP
              </span>
            </div>
          ) : mrpDiscountPct > 0 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-2.5 py-1 text-center shadow-md">
              <span className="block text-[11px] font-black uppercase text-white tracking-tight">
                {mrpDiscountPct}% OFF MRP
              </span>
            </div>
          ) : null}

          {/* Bottom Badges on Image */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-1 items-start">
            {deal.isAllTimeLow && (
              <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-950 shadow-xs flex items-center gap-1">
                <span>★</span>
                <span>All-Time Low Price</span>
              </span>
            )}
            {deal.coupon?.label && (
              <span className="rounded-md bg-purple-700 px-2 py-0.5 text-[9.5px] font-bold text-white shadow-xs">
                🏷️ {deal.coupon.label}
              </span>
            )}
          </div>
        </Link>

        {/* Title */}
        <h3 className="mt-3 line-clamp-2 min-h-[36px] text-xs sm:text-[13px] font-bold leading-snug text-slate-900 group-hover:text-brand transition-colors">
          <Link href={cardHref}>{deal.title || 'Special Promotion Deal'}</Link>
        </h3>

        {/* ═══ PRICE DROP & MRP INTELLIGENCE CARD ═══ */}
        <div className="mt-3 rounded-xl bg-slate-50/90 p-3 border border-slate-100">
          {/* Current Deal Price & MRP */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
              {formatInr(currentPrice)}
            </span>
            {hasMrp && (
              <span className="text-xs font-bold text-slate-400 line-through">
                MRP {formatInr(listMrp)}
              </span>
            )}
            {mrpDiscountPct > 0 && (
              <span className="text-[11px] font-extrabold text-orange-600">
                ({mrpDiscountPct}% off)
              </span>
            )}
          </div>

          {/* Explicit Price Drop Information */}
          {hasPriceDrop ? (
            <div className="mt-1.5 rounded-lg bg-emerald-50 px-2 py-1 border border-emerald-200/70">
              <p className="text-[11px] font-black text-emerald-800 flex items-center gap-1">
                <span>📉</span>
                <span>Price Drop: ₹{priceDropCash.toLocaleString('en-IN')} ({priceDropPct}% drop)</span>
              </p>
              <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                Usually tracked at <span className="line-through font-bold">{formatInr(previousTrackedPrice)}</span>
              </p>
            </div>
          ) : hasMrp && mrpSavings > 0 ? (
            <p className="mt-1 text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
              <span>💰</span>
              <span>You save ₹{mrpSavings.toLocaleString('en-IN')} off list price</span>
            </p>
          ) : null}

          {/* Verification & Expiry Notice */}
          <div className="mt-2 flex items-center justify-between text-[9.5px] font-semibold text-slate-400 pt-1.5 border-t border-slate-200/60">
            <span>Verified against 90-day history</span>
            <span className="text-amber-700 font-bold">Limited time deal</span>
          </div>
        </div>
      </div>

      {/* Dual Actions: Get Deal + View 90-Day History */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBuyClick}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-black text-white shadow-xs transition-all hover:bg-[#e05d00] hover:shadow-md active:scale-[0.98]"
        >
          <span>⚡ GET DEAL</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>

        <Link
          href={cardHref}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-extrabold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs"
          title="Inspect 90-day price history chart"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="hidden sm:inline">Price Chart</span>
        </Link>
      </div>
    </article>
  );
}
