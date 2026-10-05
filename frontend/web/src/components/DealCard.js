'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useCompare } from '@/lib/useCompare';
import { getAffiliateUrl, getMerchantInfo, formatRelativeTime, formatInr, isUsableImageUrl } from '@/lib/affiliate';
import { categoryLabel, subcategoryLabel } from '@/lib/taxonomy';
import { logEvent } from '@/lib/analytics';
import { saveDealItem, isDealSaved } from '@/lib/savedDeals';
import { emitSavedChanged } from '@/lib/useSavedCount';
import { trackRecentlyViewed } from '@/components/RecentlyViewed';
import { computePriceStats } from '@/lib/priceAnalytics';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';

/**
 * Myntra-style grid card — real <article>/<h3>/<a> markup (not RN View/Text) so crawlers see
 * product content directly, and the "GET DEAL" link is a genuine <a href> for middle-click /
 * open-in-new-tab instead of a JS-only onPress handler.
 */
export default function DealCard({ deal, savedDeals = [], onSavedChange, onImageUnavailable }) {
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user, token } = useAuth();
  const { isInCompare, toggleCompare } = useCompare();

  // formatRelativeTime("Xm ago") is the one genuinely non-deterministic value here — it's a
  // function of Date.now() at render time, which differs between the SSR pass and the browser's
  // hydration pass by however long the response took to arrive. React 19 (correctly) treats that
  // as a hydration error, not just a warning. suppressHydrationWarning below is the React-
  // documented pattern for exactly this case; the tick state re-renders it every 30s afterwards
  // so it keeps counting up instead of freezing at whatever the server happened to compute.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const dealId = deal._id || deal.id;
  // When the server has resolved a linked product, link straight to /product/[id] so Google
  // crawls the canonical page directly instead of following a /deal → /product redirect.
  // Falls back to /deal/[id] for standalone deals (no matching tracked product) and for
  // client-side polled items that don't carry linkedProductId.
  const cardHref = deal.linkedProductId ? `/product/${deal.linkedProductId}` : `/deal/${dealId}`;
  const dealCountry = deal.country || 'IN';
  const merchant = getMerchantInfo(deal.merchant || deal.dealUrl);
  const dealPriceStr = formatInr(deal.dealPrice, dealCountry) || 'Special Price';
  const stats = deal.priceStats || computePriceStats(deal);
  
  // Authentic price drop: strictly against previously recorded real selling price
  const hasRealPriceDrop = Boolean(deal.previousPrice && deal.previousPrice > (deal.dealPrice || 0));
  const realPriceDrop = hasRealPriceDrop ? deal.previousPrice - deal.dealPrice : 0;
  const realPriceDropPct = hasRealPriceDrop ? Math.round((realPriceDrop / deal.previousPrice) * 100) : 0;

  // Statutory printed MRP discount (kept completely separate from real price drop)
  const hasMrp = Boolean(deal.originalPrice && deal.originalPrice > (deal.dealPrice || 0));
  const mrpDiscount = hasMrp ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100) : 0;

  const saved = isDealSaved(dealId, savedDeals);
  const couponLabel = deal.coupon?.label || null;
  const dealTime = formatRelativeTime(deal.createdAt || deal.postedAt || deal.updatedAt);

  // Fix #8: Stale deal indicator — deals > 6h may be expired; 3-6h are ending soon
  const dealAgeMs = deal.createdAt ? Date.now() - new Date(deal.createdAt).getTime() : 0;
  const isPossiblyExpired = dealAgeMs > 6 * 60 * 60 * 1000;   // > 6 hours
  const isEndingSoon    = !isPossiblyExpired && dealAgeMs > 3 * 60 * 60 * 1000; // 3–6 hours

  const handleToggleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    const authUser = user && token ? { ...user, token } : null;
    const updated = await saveDealItem(deal, authUser);
    setSaving(false);
    if (!saved) logEvent('add_to_wishlist', { item_id: dealId, item_name: deal.title });
    emitSavedChanged();
    onSavedChange?.(updated);
  };

  const handleBuyClick = () => {
    logEvent('click_deal', { item_id: dealId, item_name: deal.title });
    trackRecentlyViewed(deal);
  };

  return (
    <article className="sd-grid-card flex flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xs">
      <Link href={cardHref} className="relative block aspect-square w-full bg-[#fafafa] p-3" onClick={() => logEvent('select_item', { item_id: dealId, item_list_name: 'deals' })}>
        {isUsableImageUrl(deal.imageUrl) && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.imageUrl}
            alt={deal.title || 'Product image'}
            onError={() => {
              setImgError(true);
              onImageUnavailable?.(dealId);
            }}
            onLoad={(e) => {
              // Catch transparent 1x1 blank GIFs served with HTTP 200 by CDNs
              if (e.target.naturalWidth <= 2 || e.target.naturalHeight <= 2) {
                setImgError(true);
                onImageUnavailable?.(dealId);
              }
            }}
            className="sd-grid-image absolute inset-0 m-auto h-[84%] w-[84%] object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] rounded-xl">
            {merchant.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={merchant.logo} alt={merchant.label} className="mb-2 h-6 w-auto object-contain opacity-80" />
            ) : (
              <span className="mb-1 text-2xl">{merchant.emoji || '🛍️'}</span>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">
              {merchant.label} Verified
            </span>
          </div>
        )}

        {hasRealPriceDrop ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-emerald-600 px-2 py-1 text-[10.5px] font-extrabold text-white shadow-xs">
            {realPriceDropPct}% DROP
          </span>
        ) : hasMrp && mrpDiscount >= 10 ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-[#1a1a1a] px-2 py-1 text-[10.5px] font-extrabold text-white">
            {mrpDiscount}% OFF
          </span>
        ) : null}

        {/* Badges — only claim PRICE DROP if genuine historical drop from previous tracked price */}
        {stats?.isAllTimeLow ? (
          <span className="absolute right-20 top-2.5 hidden rounded-md border border-[#86efac] bg-[#f0fdf4] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#15803d] sm:inline-block">
            🔥 ALL-TIME LOW
          </span>
        ) : hasRealPriceDrop && realPriceDropPct >= 10 ? (
          <span className="absolute right-20 top-2.5 hidden rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#15803d] sm:inline-block">
            📉 {realPriceDropPct}% TRUE DROP
          </span>
        ) : stats?.isFakeMrpDiscount ? (
          <span className="absolute right-20 top-2.5 hidden rounded-md border border-[#fef08a] bg-[#fefce8] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#854d0e] sm:inline-block">
            ⚖️ REGULAR PRICE
          </span>
        ) : mrpDiscount >= 60 ? (
          <span className="absolute right-20 top-2.5 hidden rounded-md border border-[#fecdd3] bg-[#fff1f2] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#e11d48] sm:inline-block">
            MRP {mrpDiscount}% OFF
          </span>
        ) : mrpDiscount >= 40 ? (
          <span className="absolute right-20 top-2.5 hidden rounded-md border border-[#fed7aa] bg-[#fff7ed] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#ea580c] sm:inline-block">
            MRP {mrpDiscount}% OFF
          </span>
        ) : null}

        <button
          type="button"
          aria-label={isInCompare(dealId) ? 'Remove from comparison' : 'Add to comparison'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCompare(deal);
          }}
          className={`absolute right-10.5 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-all ${
            isInCompare(dealId) ? 'bg-brand text-white' : 'bg-white text-[#4b5563] hover:text-[#111]'
          }`}
          title={isInCompare(dealId) ? 'Remove from comparison' : 'Compare product'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
          </svg>
        </button>

        <button
          type="button"
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={handleToggleSave}
          disabled={saving}
          className="absolute right-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#ff3f6c' : 'none'} stroke={saved ? '#ff3f6c' : '#333'} strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-[13px]">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center shrink-0">
            {renderStoreLogo(deal.merchant || merchant.id || merchant.label, 'h-4 w-auto object-contain')}
          </div>
          {isPossiblyExpired ? (
            <span className="flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]" suppressHydrationWarning>
              ⏱ Possibly Expired
            </span>
          ) : isEndingSoon ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600" suppressHydrationWarning>
              ⏳ Ending Soon
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#878b94]" suppressHydrationWarning>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {dealTime}
            </span>
          )}
        </div>

        {deal.category && (
          <Link
            href={`/?category=${encodeURIComponent(deal.category)}${deal.subcategory ? `&subcategory=${encodeURIComponent(deal.subcategory)}` : ''}`}
            className="mb-1 inline-block max-w-full truncate text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] hover:text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {categoryLabel(deal.category)}{deal.subcategory ? ` · ${subcategoryLabel(deal.subcategory)}` : ''}
          </Link>
        )}

        <Link href={cardHref}>
          <h3 className="mb-1.5 line-clamp-2 text-[12.5px] font-semibold leading-[17px] text-[#1a1a2e]">
            {deal.title || 'Featured Deal'}
          </h3>
        </Link>

        {/* Truth Badges */}
        {stats?.isAllTimeLow ? (
          <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-[#f0fdf4] border border-[#86efac] px-1.5 py-0.5 text-[10px] font-extrabold text-[#15803d]">
            🔥 All-Time Lowest Price
          </span>
        ) : hasRealPriceDrop && realPriceDropPct >= 5 ? (
          <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-[#f0fdf4] border border-[#86efac] px-1.5 py-0.5 text-[10px] font-extrabold text-[#15803d]">
            📉 ₹{realPriceDrop.toLocaleString('en-IN')} True Drop
          </span>
        ) : stats?.isFakeMrpDiscount ? (
          <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-[#fffbeb] border border-[#fcd34d] px-1.5 py-0.5 text-[10px] font-extrabold text-[#92400e]">
            ⚠️ Everyday Price · Inflated MRP
          </span>
        ) : stats?.isBelowAverage ? (
          <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-[#eff6ff] border border-[#bfdbfe] px-1.5 py-0.5 text-[10px] font-extrabold text-[#1d4ed8]">
            ✓ Below 30-Day Average
          </span>
        ) : null}

        {deal.isSeriesCard && deal.seriesVariantCount > 1 ? (
          <div className="mb-1.5">
            <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10.5px] font-extrabold text-brand">
              <span>✨</span>
              <span>{deal.seriesVariantCount} Variants</span>
              {deal.seriesStorages?.length > 0 && (
                <span className="font-semibold text-gray-700">({deal.seriesStorages.slice(0, 2).join(', ')})</span>
              )}
              {deal.seriesColors?.length > 0 && (
                <span className="font-semibold text-gray-600">· {deal.seriesColors.length} Colors</span>
              )}
              {deal.seriesShades?.length > 0 && (
                <span className="font-semibold text-gray-600">· {deal.seriesShades.length} Shades</span>
              )}
            </span>
          </div>
        ) : deal.variant?.display ? (
          <span className="mb-1.5 inline-flex w-fit items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-gray-600">
            {deal.variant.display}
          </span>
        ) : null}

        <div className="mb-1 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[14px] font-extrabold text-[#1a1a2e]">
            {deal.isSeriesCard && deal.seriesVariantCount > 1 ? `From ${dealPriceStr}` : dealPriceStr}
          </span>
          {hasRealPriceDrop ? (
            <>
              <span className="text-[11.5px] font-medium text-[#7E818C] line-through">
                Was {formatInr(deal.previousPrice, dealCountry)}
              </span>
              <span className="text-[11.5px] font-bold text-[#16a34a]">
                {realPriceDropPct}% drop
              </span>
            </>
          ) : hasMrp ? (
            <>
              <span className="text-[11.5px] font-medium text-[#7E818C] line-through">
                MRP {formatInr(deal.originalPrice, dealCountry)}
              </span>
              {mrpDiscount > 0 && (
                <span className="text-[11.5px] font-bold text-[#16a34a]">
                  {mrpDiscount}% off MRP
                </span>
              )}
            </>
          ) : null}
        </div>

        {hasRealPriceDrop ? (
          <p className="mb-2 text-[11px] font-bold text-[#16a34a]">
            📉 Genuine Drop: You save {formatInr(realPriceDrop, dealCountry)}
          </p>
        ) : hasMrp && mrpDiscount >= 15 ? (
          <p className="mb-2 text-[10.5px] font-semibold text-[#64748b]">
            You save {formatInr(deal.originalPrice - deal.dealPrice, dealCountry)} off list MRP
          </p>
        ) : null}

        {couponLabel && (
          <div className="mb-2 inline-flex max-w-full items-center rounded border border-[#ffe0a3] bg-[#fff8e6] px-1.5 py-0.5">
            <span className="truncate text-[10.5px] font-bold text-[#7a5200]">🏷️ {couponLabel}</span>
          </div>
        )}

        {deal.isSeriesCard && deal.seriesVariantCount > 1 ? (
          <Link
            href={cardHref}
            className="mt-auto flex items-center justify-center rounded-lg border border-brand bg-brand/5 py-2.5 text-[11.5px] font-extrabold text-brand transition-colors hover:bg-brand hover:text-white tracking-wide shadow-2xs"
          >
            View {deal.seriesVariantCount} Options →
          </Link>
        ) : (
          <a
            href={getAffiliateUrl(deal.dealUrl, dealCountry)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleBuyClick}
            style={{ backgroundColor: merchant.btnColor, color: merchant.textColor }}
            className="mt-auto flex items-center justify-center rounded-lg py-2.5 text-[11.5px] font-extrabold tracking-wide"
          >
            ⚡ GET DEAL
          </a>
        )}

        {/* View Price History — surfaces our core differentiator, keeps users on ShoppersDeals */}
        <Link
          href={cardHref}
          className="mt-1.5 flex items-center justify-center gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] py-1.5 text-[11px] font-bold text-[#4f46e5] hover:bg-[#f0f0ff] transition-colors"
          onClick={() => logEvent('view_history', { item_id: dealId, item_name: deal.title })}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          View Price History
        </Link>
      </div>
    </article>
  );
}
