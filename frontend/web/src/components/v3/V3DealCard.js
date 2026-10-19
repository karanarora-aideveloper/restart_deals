'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, getCrawlFreshness, isUsableImageUrl, getOptimizedImageUrl, getImageSrcSet } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { isDealSaved, saveDealItem } from '@/lib/savedDeals';
import { useAuth } from '@/components/AuthProvider';
import { emitSavedChanged } from '@/lib/useSavedCount';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';

function formatInr(val) {
  if (val === null || val === undefined || isNaN(val)) return 'Special Price';
  return `₹${Math.round(Number(val)).toLocaleString('en-IN')}`;
}

export function formatDealCardTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return 'Special Promotion Deal';
  let t = rawTitle.trim();
  // Strip promo clutter
  t = t.replace(/^\[?apply\s+(?:₹?\d+%?|\d+%)?\s*(?:off)?\s*coupon\]?\s*[:|–-]?\s*/i, '');
  t = t.replace(/^\d{1,2}%\s+off\s*[:|–-]\s*/i, '');
  t = t.replace(/^(?:big\s+)?loot(?:\s+deal|\s+offer|\s+fast)?\s*[:|–-]\s*/i, '');
  t = t.replace(/^loot\s+for\s+needy\s*[:|–-]\s*/i, '');
  t = t.replace(/^ac\s+loot\s*[:|–-]\s*/i, '');
  t = t.replace(/^amazon\s*[:|–-]\s*/i, '');
  t = t.replace(/^(?:flipkart|shopsy|myntra|ajio)\s+(?:bbd|gif)?\s*loot\s*[:|–-]\s*/i, '');

  if (t.includes('|')) {
    const parts = t.split('|').map(p => p.trim());
    if (/coupon|bank|loot|discount|deal|off\b/i.test(parts[0]) && parts[1] && parts[1].length >= 8) {
      t = parts[1];
    }
  }

  t = t.replace(/^[\s+–|:-]+/, '');
  t = t.replace(/\s+(?:at|@)\s*(?:rs\.?|₹)?\s*[\d,]+.*$/i, '');
  t = t.replace(/\s*₹\s*[\d,]+.*$/i, '');
  t = t.replace(/\s*[:|–-]\s*$/i, '');
  t = t.replace(/\s+/g, ' ').trim();

  // If title was a placeholder like "Amazon root link", "Master Link :", or "Amazon Item (...)"
  if (
    /root\s*link|loot\s*link|master\s*link|spin\s*link|link\s*:|:\s*link/i.test(t) ||
    /^amazon\s+item\s*\(/i.test(t) ||
    /^amazon\s+deal\s*\(/i.test(t) ||
    /^loot\s*(\d+|\:|\-|\₹)/i.test(t) ||
    t.length < 5
  ) {
    return 'Special Promotion Deal';
  }

  return t;
}

export default function V3DealCard({ deal, index = 0, savedDeals = [], onSavedChange, onImageUnavailable }) {
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [navigatingHistory, setNavigatingHistory] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const dealId = deal._id || deal.id;
  const merchant = getMerchantInfo(deal.merchant || deal.dealUrl);
  const dealCountry = (deal.country || 'IN').toUpperCase();
  const displayTitle = formatDealCardTitle(deal.title);

  // Pricing Fields
  const currentPrice = Number(deal.dealPrice || 0);
  const listMrp = Number(deal.originalPrice || 0);
  let previousTrackedPrice = Number(deal.previousPrice || 0);
  if (listMrp > 0 && previousTrackedPrice > listMrp) {
    previousTrackedPrice = listMrp;
  }

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
  const dealTime = deal.createdAt || deal.postedAt || deal.updatedAt;
  const verifiedTime = formatRelativeTime(dealTime);
  const crawlTime = deal.lastVerifiedAt || deal.updatedAt || deal.postedAt || deal.createdAt;
  const freshness = getCrawlFreshness(crawlTime);

  let rawImage = deal.imageUrl || (Array.isArray(deal.images) && deal.images[0]) || '';
  if (rawImage.startsWith('http://') && !rawImage.includes('localhost') && !rawImage.includes('127.0.0.1')) {
    rawImage = rawImage.replace(/^http:\/\//i, 'https://');
  }
  const hasValidImage = isUsableImageUrl(rawImage) && !imgError;

  // Flipkart-grade Smart Verdict Pill
  let verdictText = 'Verified Deal';
  let verdictBg = 'bg-slate-50 text-slate-700 border-slate-200/80 font-bold';
  if (deal.isAllTimeLow) {
    verdictText = '🔥 All-Time Low Price';
    verdictBg = 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 text-amber-950 border-amber-300/90 font-black';
  } else if (mrpDiscountPct >= 50 || priceDropPct >= 20) {
    verdictText = '⚡ Steal Deal (Buy Now)';
    verdictBg = 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 text-emerald-950 border-emerald-300/90 font-black';
  } else if (hasPriceDrop) {
    verdictText = `📉 ₹${priceDropCash.toLocaleString('en-IN')} Price Drop`;
    verdictBg = 'bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-teal-500/5 text-teal-950 border-teal-200/90 font-extrabold';
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

  const isDeferred = index >= 8;

  return (
    <article
      style={isDeferred ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 380px' } : undefined}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_1px_4px_-1px_rgba(15,23,42,0.02)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_12px_24px_-4px_rgba(15,23,42,0.1),0_4px_8px_-2px_rgba(15,23,42,0.04)]"
    >
      <div className="min-w-0">
        {/* Top Header: Store Badge + Deal Age + Wishlist */}
        <div className="flex items-center justify-between gap-1.5 mb-2 min-w-0">
          {/* Store Micro-Pill */}
          <div className="flex h-6 items-center px-1.5 py-0.5 rounded-lg bg-slate-50/90 border border-slate-200/60 shadow-2xs shrink-0">
            {renderStoreLogo(deal.merchant || merchant.id || merchant.label, 'h-3.5 max-h-3.5 w-auto object-contain')}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Live Deal Age Badge with radar ping */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[8.5px] font-bold text-emerald-700 tracking-tight whitespace-nowrap shadow-2xs"
              title={`Deal verified: ${formatRelativeTime(dealTime)}`}
              suppressHydrationWarning
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span suppressHydrationWarning>{mounted ? verifiedTime : 'Verified'}</span>
            </span>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={isSaving}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 active:scale-90 ${
                saved
                  ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200/60'
              }`}
              aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <svg
                className="h-3 w-3"
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

        {/* Product Image Frame */}
        <Link
          href={cardHref}
          onClick={() => setNavigatingHistory(true)}
          className="relative block h-36 sm:h-40 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-white/90 p-2.5 border border-slate-100"
        >
          {navigatingHistory && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 backdrop-blur-2xs rounded-xl animate-in fade-in duration-150">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-1" />
              <span className="text-[9.5px] font-black text-indigo-700 animate-pulse">Loading Chart…</span>
            </div>
          )}
          {hasValidImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getOptimizedImageUrl(rawImage, 'card')}
              srcSet={getImageSrcSet(rawImage)}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              alt={displayTitle}
              className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => {
                setImgError(true);
                onImageUnavailable?.(dealId);
              }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-center p-2">
              <span className="text-2xl mb-1">{merchant.emoji || '🛍️'}</span>
              <span className="text-[10px] font-bold text-slate-500 line-clamp-1">{merchant.name} Deal</span>
            </div>
          )}

          {/* Top-Right Badge: Modern Pill with subtle gradient and micro shadow */}
          {hasPriceDrop && priceDropPct >= 3 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-center shadow-xs">
              <span className="block text-[9px] font-black uppercase text-white tracking-wide whitespace-nowrap">
                📉 {priceDropPct}% DROP
              </span>
            </div>
          ) : mrpDiscountPct > 0 ? (
            <div className="absolute top-2 right-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-2 py-0.5 text-center shadow-xs">
              <span className="block text-[9px] font-black uppercase text-white tracking-wide whitespace-nowrap">
                {mrpDiscountPct}% OFF
              </span>
            </div>
          ) : null}
        </Link>

        {/* Title: Strict 2-line clamp with min-height */}
        <h3 className="mt-2.5 line-clamp-2 min-h-[34px] sm:min-h-[36px] text-[12.5px] sm:text-[13px] font-bold leading-[1.3] text-slate-900 tracking-[-0.015em] group-hover:text-indigo-600 transition-colors">
          <Link href={cardHref} title={displayTitle}>
            {displayTitle}
          </Link>
        </h3>

        {/* Smart Verdict: Full Width with subtle gradient & icon */}
        <div className="mt-2 flex items-center min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9.5px] truncate w-full shadow-2xs ${verdictBg}`}>
            <span className="truncate">{verdictText}</span>
          </span>
        </div>

        {/* Clean Pricing Hierarchy — Genuine Price Drop Priority */}
        <div className="mt-2.5 rounded-xl bg-gradient-to-b from-slate-50/90 to-slate-100/60 p-2.5 border border-slate-200/70 min-w-0 shadow-2xs">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-950">
              {formatInr(currentPrice)}
            </span>
            {hasPriceDrop ? (
              <>
                <span className="text-[10.5px] font-semibold text-slate-400 line-through">
                  {formatInr(previousTrackedPrice)}
                </span>
                <span className="rounded bg-emerald-100/80 px-1.5 py-0.2 text-[9px] font-black text-emerald-700 whitespace-nowrap">
                  {priceDropPct}% drop
                </span>
              </>
            ) : hasMrp ? (
              <>
                <span className="text-[10.5px] font-semibold text-slate-400 line-through">
                  {formatInr(listMrp)}
                </span>
                {mrpDiscountPct > 0 && (
                  <span className="rounded bg-indigo-100/80 px-1.5 py-0.2 text-[9px] font-black text-indigo-700 whitespace-nowrap">
                    {mrpDiscountPct}% off
                  </span>
                )}
              </>
            ) : null}
          </div>

          {/* Genuine Drop or Savings Callout + Checked Timestamp */}
          <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex flex-col gap-1 min-w-0">
            <div className="font-extrabold text-[10.5px] leading-tight">
              {hasPriceDrop ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <span>📉</span>
                  <span>₹{priceDropCash.toLocaleString('en-IN')} True Drop</span>
                </span>
              ) : mrpSavings > 0 ? (
                <span className="text-slate-700 flex items-center gap-1">
                  <span>💰</span>
                  <span>Save ₹{mrpSavings.toLocaleString('en-IN')}</span>
                </span>
              ) : deal.hasPriceHistory ? (
                <span className="text-indigo-700 flex items-center gap-1">
                  <span>📈</span>
                  <span>History Tracked</span>
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <span>✓</span>
                  <span>Verified Price</span>
                </span>
              )}
            </div>

            {/* Below this: Last Checked Timestamp */}
            <div
              className={`text-[9.5px] font-semibold tracking-tight flex items-center gap-1.5 ${
                freshness.status === 'fresh' ? 'text-emerald-700' :
                freshness.status === 'stale' ? 'text-rose-600 font-bold' :
                freshness.status === 'aging' ? 'text-amber-700' :
                'text-slate-500'
              }`}
              title={freshness.tooltip}
              suppressHydrationWarning
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${freshness.dotClass}`} />
              <span suppressHydrationWarning>{mounted ? freshness.label : 'Checked recently'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dual CTA Actions: Modern High-Converting Button Layout */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 min-w-0">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleBuyClick}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 py-2.5 px-2 text-[11px] font-black uppercase tracking-wide text-white shadow-[0_2px_8px_-1px_rgba(79,70,229,0.35)] transition-all duration-200 hover:from-indigo-700 hover:to-violet-700 hover:shadow-[0_4px_14px_-1px_rgba(79,70,229,0.45)] active:scale-[0.98]"
        >
          <span className="truncate">⚡ BUY NOW</span>
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>

        <Link
          href={cardHref}
          onClick={() => setNavigatingHistory(true)}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-extrabold transition-all duration-200 shadow-2xs ${
            navigatingHistory
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-inner'
              : 'border-slate-200/90 bg-white hover:bg-indigo-50/50 hover:border-indigo-300 text-slate-700 hover:text-indigo-600'
          }`}
          title="View 90-day price history graph"
        >
          {navigatingHistory ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent shrink-0" />
              <span className="text-[10px] animate-pulse">Loading…</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 text-indigo-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="hidden md:inline text-[10px]">Graph</span>
            </>
          )}
        </Link>
      </div>
    </article>
  );
}
