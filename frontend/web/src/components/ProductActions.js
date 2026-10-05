'use client';

import React, { useState, useEffect } from 'react';
import { getAffiliateUrl, formatInr, formatRelativeTime } from '@/lib/affiliate';
import {
  logEvent,
  trackOutboundClick,
  trackWishlistToggle,
  trackPriceAlertOpen,
  trackEvent,
} from '@/lib/analytics';
import { API_BASE_URL } from '@/lib/config';
import PriceAlertModal from './PriceAlertModal';
import { usePushNotification } from '@/lib/usePushNotification';
import { useAuth } from '@/components/AuthProvider';
import { getSavedDeals, saveDealItem, isDealSaved } from '@/lib/savedDeals';
import { emitSavedChanged, SAVED_CHANGED_EVENT } from '@/lib/useSavedCount';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';

function getMerchantButtonTheme(merchantId) {
  switch (merchantId) {
    case 'amazon':
      return {
        containerClass: 'bg-gradient-to-r from-[#FF9900] via-[#FFA41C] to-[#FF8C00] text-slate-950 border border-amber-400/60 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-slate-950/10 text-slate-950 border border-slate-950/10',
        iconBgClass: 'bg-white/95 text-slate-950 shadow-2xs',
      };
    case 'flipkart':
      return {
        containerClass: 'bg-gradient-to-r from-[#2874F0] via-[#1D4ED8] to-[#1E40AF] text-white border border-blue-400/50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-blue-600 shadow-2xs',
      };
    case 'myntra':
      return {
        containerClass: 'bg-gradient-to-r from-[#FF3F6C] via-[#F43F5E] to-[#E11D48] text-white border border-pink-400/50 shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-pink-600 shadow-2xs',
      };
    case 'meesho':
      return {
        containerClass: 'bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] text-white border border-violet-400/50 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-violet-600 shadow-2xs',
      };
    case 'shopsy':
      return {
        containerClass: 'bg-gradient-to-r from-[#A855F7] via-[#9333EA] to-[#7E22CE] text-white border border-purple-400/50 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-purple-600 shadow-2xs',
      };
    case 'nykaa':
      return {
        containerClass: 'bg-gradient-to-r from-[#FC2779] via-[#E11D48] to-[#BE123C] text-white border border-pink-400/50 shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-pink-600 shadow-2xs',
      };
    default:
      return {
        containerClass: 'bg-gradient-to-r from-[#FF6B00] via-[#EA580C] to-[#C2410C] text-white border border-orange-400/50 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 hover:brightness-105 active:scale-[0.99]',
        pricePillClass: 'bg-white/20 text-white border border-white/20',
        iconBgClass: 'bg-white/95 text-orange-600 shadow-2xs',
      };
  }
}

export default function ProductActions({ product, merchant }) {
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isCheckingLive, setIsCheckingLive] = useState(false);
  const [liveCheckResult, setLiveCheckResult] = useState(null);
  const [currentLivePrice, setCurrentLivePrice] = useState(product?.price);
  const [activeVariant, setActiveVariant] = useState(product);

  const prodId = product?._id || product?.productId;
  const { isSupported: isPushSupported, isProductTracked, trackProduct, loading: pushLoading } = usePushNotification();
  const [justTracked, setJustTracked] = useState(false);
  const isTracked = (prodId && isProductTracked(prodId)) || justTracked;

  const { user, token } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkWishlist() {
      const authUser = user && token ? { ...user, token } : null;
      const list = await getSavedDeals(authUser);
      if (!cancelled && Array.isArray(list)) {
        setIsWishlisted(isDealSaved(prodId, list));
      }
    }
    checkWishlist();
    window.addEventListener(SAVED_CHANGED_EVENT, checkWishlist);
    return () => {
      cancelled = true;
      window.removeEventListener(SAVED_CHANGED_EVENT, checkWishlist);
    };
  }, [prodId, user, token]);

  const handleToggleWishlist = async () => {
    const authUser = user && token ? { ...user, token } : null;
    const dealObject = {
      _id: prodId,
      id: prodId,
      productId: product?.productId || prodId,
      title: product?.title,
      price: currentLivePrice || product?.price,
      previousPrice: product?.previousPrice,
      originalPrice: product?.originalPrice,
      imageUrl: product?.imageUrl,
      cleanUrl: product?.cleanUrl,
      merchant: product?.merchant,
      country: product?.country,
    };
    const updated = await saveDealItem(dealObject, authUser);
    const nextSaved = isDealSaved(prodId, updated);
    setIsWishlisted(nextSaved);
    trackWishlistToggle(product, nextSaved, updated.length);
    emitSavedChanged();
  };

  React.useEffect(() => {
    const handleVariantChanged = (e) => {
      const v = e.detail;
      if (v) {
        setActiveVariant((prev) => ({ ...prev, ...v }));
        if (v.price) setCurrentLivePrice(v.price);
      }
    };
    window.addEventListener('sd:variant-selected', handleVariantChanged);
    return () => window.removeEventListener('sd:variant-selected', handleVariantChanged);
  }, []);

  const cleanStoreName = (product?.merchant || 'Store').split('.')[0];
  const capitalizedStore = cleanStoreName.charAt(0).toUpperCase() + cleanStoreName.slice(1);
  const theme = getMerchantButtonTheme(merchant?.id);

  const handleLiveVerification = async () => {
    setIsCheckingLive(true);
    setLiveCheckResult(null);

    try {
      const prodId = product._id || product.productId;
      const res = await fetch(`${API_BASE_URL}/api/products/${prodId}/refresh-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (data.success && data.livePrice) {
        setCurrentLivePrice(data.livePrice);
        setLiveCheckResult({
          status: 'success',
          message: `Verified Live: ${formatInr(data.livePrice, product?.country)}`,
          priceChanged: data.priceChanged,
          previousPrice: data.previousPrice,
          livePrice: data.livePrice,
          verifiedAt: new Date(),
        });
      } else {
        setLiveCheckResult({
          status: 'info',
          message: data.error || 'Live price checked.',
          verifiedAt: new Date(),
        });
      }
    } catch (err) {
      console.error('[Live Verification Error]:', err);
      setLiveCheckResult({
        status: 'error',
        message: 'Could not connect to live store. Showing latest recorded price.',
      });
    } finally {
      setIsCheckingLive(false);
    }
  };

  const lastCheckedDate = product?.lastChecked || product?.priceUpdatedAt || product?.updatedAt;

  // Fix #4: detect stale data so we don't lie to users about "live" price
  const isStale = lastCheckedDate
    ? (Date.now() - new Date(lastCheckedDate).getTime()) > 24 * 60 * 60 * 1000
    : false;

  // Fix #6: Share this deal via Web Share API (WhatsApp / native share sheet on mobile)
  const handleShare = () => {
    trackEvent('product_shared', { product_id: prodId, title: product?.title, merchant: product?.merchant });
    const shareText = `🔥 ${product?.title || 'Check this deal'}\n💰 Now at ${formatInr(product?.price, product?.country)} — Track price history on ShoppersDeals`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator?.share) {
      navigator.share({ title: product?.title, text: shareText, url: shareUrl }).catch(() => {});
    } else {
      // WhatsApp fallback
      const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleQuickPushTrack = async () => {
    if (!prodId || isTracked || pushLoading) return;
    try {
      const ok = await trackProduct(prodId);
      if (ok) {
        setJustTracked(true);
        logEvent('track_product_push', { product_id: prodId, title: product?.title });
      }
    } catch (err) {
      console.warn('[handleQuickPushTrack] Failed to track product:', err);
    }
  };

  return (
    <>
      {/* 1. Data Freshness Bar — Fix #4: amber warning when data is stale */}
      {isStale ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="font-semibold text-amber-800">
              Price last checked <span suppressHydrationWarning>{lastCheckedDate ? formatRelativeTime(lastCheckedDate) : 'a while ago'}</span> — may have changed on {capitalizedStore}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLiveVerification}
            disabled={isCheckingLive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 shadow-2xs transition hover:bg-amber-100 disabled:opacity-50"
          >
            {isCheckingLive ? (
              <>
                <svg className="h-3 w-3 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Checking…
              </>
            ) : (
              <>⚡ Refresh Price</>
            )}
          </button>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
              {liveCheckResult ? (
                liveCheckResult.message
              ) : (
                <>
                  <span>Live Verified on</span>
                  {renderStoreLogo(product?.merchant || merchant?.id, 'inline-block h-3.5 w-auto object-contain translate-y-[2px]')}
                  <span suppressHydrationWarning>{lastCheckedDate ? `(${formatRelativeTime(lastCheckedDate)})` : '(Today)'}</span>
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLiveVerification}
            disabled={isCheckingLive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {isCheckingLive ? (
              <>
                <svg className="h-3 w-3 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Checking Live...
              </>
            ) : (
              <>
                <span>⚡</span>
                Re-check Live Price
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. Price Change Alert Banner if Live Price Changed */}
      {liveCheckResult?.priceChanged && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
          <span>🔔</span>
          <span>
            Live price updated from {formatInr(liveCheckResult.previousPrice, product?.country)} to{' '}
            <strong className="font-extrabold text-brand">{formatInr(liveCheckResult.livePrice, product?.country)}</strong>!
          </span>
        </div>
      )}

      {/* 3. Action Buttons */}
      <div className="mb-6 space-y-2.5">
        {/* Primary Buy CTA - Full Width Hero Button */}
        <a
          href={getAffiliateUrl(activeVariant?.cleanUrl || product.cleanUrl, activeVariant?.country || product?.country)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => {
            const destUrl = getAffiliateUrl(activeVariant?.cleanUrl || product.cleanUrl, activeVariant?.country || product?.country);
            trackOutboundClick(activeVariant || product, destUrl, 'pdp_hero_buy_btn');
          }}
          className={`group flex w-full items-center justify-between gap-3 rounded-2xl p-3 sm:p-3.5 font-black transition-all duration-200 ${theme.containerClass}`}
        >
          {/* Store Logo / Badge + Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1 ${theme.iconBgClass}`}>
              {renderStoreLogo(product?.merchant || merchant?.id, 'h-5 w-auto max-w-[28px] object-contain')}
            </span>
            <div className="flex flex-col text-left leading-tight min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider opacity-85">Buy Direct on</span>
              <span className="text-sm sm:text-base font-black tracking-tight truncate">
                {merchant?.label || capitalizedStore}
              </span>
            </div>
          </div>

          {/* Price Pill + Arrow */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-xl px-2.5 py-1 text-xs sm:text-sm font-black backdrop-blur-xs ${theme.pricePillClass}`}>
              {formatInr(currentLivePrice || activeVariant?.price || product.price, activeVariant?.country || product?.country)}
            </span>
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-black/10 transition-transform duration-200 group-hover:translate-x-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </div>
        </a>

        {/* Secondary Row: 3-Column Wishlist + Price Alert + Share */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-[0.98] ${
              isWishlisted
                ? 'border-rose-300 bg-rose-50 text-rose-600 font-black'
                : 'border-gray-200 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-600'
            }`}
          >
            <span className="text-sm">{isWishlisted ? '❤️' : '🤍'}</span>
            <span className="truncate">{isWishlisted ? 'Saved' : 'Wishlist'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              trackPriceAlertOpen(product);
              setIsAlertModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 px-2 text-xs sm:text-sm font-bold text-gray-700 shadow-2xs transition-all hover:border-brand/40 hover:bg-orange-50/50 hover:text-brand active:scale-[0.98]"
          >
            <span className="text-sm">🔔</span>
            <span className="truncate">Alert</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 px-2 text-xs sm:text-sm font-bold text-gray-700 shadow-2xs transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="truncate">Share</span>
          </button>
        </div>

        {/* 1-Click Browser Push Quick-Track Button */}
        {isPushSupported && (
          <button
            type="button"
            onClick={handleQuickPushTrack}
            disabled={pushLoading || isTracked}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition-all shadow-2xs ${
              isTracked
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 cursor-default'
                : 'border border-dashed border-orange-300 bg-orange-50/70 text-orange-950 hover:border-brand hover:bg-orange-100/70 hover:text-brand active:scale-[0.99]'
            }`}
          >
            <span className="text-sm">{isTracked ? '✓' : pushLoading ? '⏳' : '⚡'}</span>
            <span>
              {isTracked
                ? 'Tracking Drops via Instant Browser Push'
                : pushLoading
                ? 'Enabling Browser Alert…'
                : '1-Click Track via Browser Push'}
            </span>
          </button>
        )}
      </div>

      <PriceAlertModal
        product={{ ...product, price: currentLivePrice }}
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
      />
    </>
  );
}
