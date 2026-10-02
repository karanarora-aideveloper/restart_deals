'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, isUsableImageUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { isDealSaved, saveDealItem } from '@/lib/savedDeals';
import { useAuth } from '@/components/AuthProvider';
import { emitSavedChanged } from '@/lib/useSavedCount';

function formatIndianPrice(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Special Price';
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
}

export default function V2DealCard({ deal, savedDeals = [], onSavedChange, onImageUnavailable }) {
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user, token } = useAuth();

  const dealId = deal._id || deal.id;
  const merchant = getMerchantInfo(deal.merchant || deal.dealUrl);
  const dealCountry = (deal.country || 'IN').toUpperCase();

  // Pricing & Real Drops
  const dealPrice = Number(deal.dealPrice || 0);
  const originalPrice = Number(deal.originalPrice || 0);
  const previousPrice = Number(deal.previousPrice || 0);

  const dealPriceStr = formatIndianPrice(dealPrice);
  const hasMrp = originalPrice > dealPrice;
  const mrpStr = hasMrp ? formatIndianPrice(originalPrice) : null;

  // Real savings amount & percentage
  const flatSavings = hasMrp ? originalPrice - dealPrice : (previousPrice > dealPrice ? previousPrice - dealPrice : 0);
  const discountPct = deal.discountPercentage ||
    (hasMrp ? Math.round(((originalPrice - dealPrice) / originalPrice) * 100) : 0);

  const hasRealPriceDrop = previousPrice > dealPrice;
  const realPriceDrop = hasRealPriceDrop ? previousPrice - dealPrice : 0;

  const saved = isDealSaved(dealId, savedDeals);
  const cardHref = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${dealId}`;
  const affiliateUrl = getAffiliateUrl(deal.dealUrl || deal.url, dealCountry);

  // Robust image fallback
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

  // Merchant badge styling
  const merchantBadges = {
    amazon: { name: 'Amazon Prime', bg: 'bg-[#FF9900]/10', border: 'border-[#FF9900]/40', text: 'text-[#9a5b00]' },
    flipkart: { name: 'Flipkart Assured', bg: 'bg-[#2874F0]/10', border: 'border-[#2874F0]/40', text: 'text-[#1c55b3]' },
    myntra: { name: 'Myntra Fashion', bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700' },
    nykaa: { name: 'Nykaa Beauty', bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700' },
    ajio: { name: 'Ajio Trends', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
    meesho: { name: 'Meesho Loot', bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
    croma: { name: 'Croma Electronics', bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700' },
  };
  const mKey = (deal.merchant || '').toLowerCase();
  const mBadge = merchantBadges[mKey] || {
    name: merchant.name || 'Verified Store',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-700',
  };

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl">
      <div>
        {/* Top Header Strip: Store Pill + Wishlist Button */}
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${mBadge.bg} ${mBadge.border} ${mBadge.text}`}>
            <span>{merchant.emoji || '🛍️'}</span>
            <span>{mBadge.name}</span>
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

        {/* Product Image Area with High-Contrast Discount Badge */}
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

          {/* Prominent High-Contrast Discount Tag on Image */}
          {discountPct > 0 && (
            <div className="absolute top-2 right-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-2.5 py-1 text-center shadow-md">
              <span className="block text-[11px] font-black uppercase text-white tracking-tight">
                {discountPct}% OFF
              </span>
            </div>
          )}

          {/* Bottom Badge: ATL or Price Drop */}
          {deal.isAllTimeLow ? (
            <div className="absolute bottom-2 left-2 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-sm flex items-center gap-1">
              <span>★</span>
              <span>All-Time Low Price</span>
            </div>
          ) : realPriceDrop > 0 ? (
            <div className="absolute bottom-2 left-2 rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
              <span>📉</span>
              <span>₹{realPriceDrop.toLocaleString('en-IN')} Drop</span>
            </div>
          ) : null}
        </Link>

        {/* Title */}
        <h3 className="mt-3 line-clamp-2 min-h-[36px] text-xs sm:text-[13px] font-bold leading-snug text-slate-900 group-hover:text-brand transition-colors">
          <Link href={cardHref}>{deal.title || 'Special Promotion Deal'}</Link>
        </h3>

        {/* 90-Day Math Trust Stamp & Timestamp */}
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span>90-Day Verified</span>
          </span>
          <span className="text-slate-400">
            {formatRelativeTime(deal.createdAt || deal.updatedAt)}
          </span>
        </div>

        {/* Price & Savings Box */}
        <div className="mt-3 rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
              {dealPriceStr}
            </span>
            {mrpStr && (
              <span className="text-xs font-bold text-slate-400 line-through">
                {mrpStr}
              </span>
            )}
          </div>

          {/* Prominent Savings Callout */}
          {flatSavings > 0 && (
            <p className="mt-1 text-[11px] font-extrabold text-emerald-700 flex items-center gap-1">
              <span>🎉</span>
              <span>Save ₹{Math.round(flatSavings).toLocaleString('en-IN')} ({discountPct}% discount)</span>
            </p>
          )}
        </div>
      </div>

      {/* Dual CTA: Buy Deal + 90-Day History Chart */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBuyClick}
          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-xs font-black text-white shadow-xs transition-all hover:bg-[#e05d00] hover:shadow-md active:scale-[0.98]"
        >
          <span>⚡ GET DEAL</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>

        <Link
          href={cardHref}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-extrabold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
          title="Inspect 90-day price history chart"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="hidden sm:inline">History</span>
        </Link>
      </div>
    </article>
  );
}
