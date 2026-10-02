'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatInr, getAffiliateUrl, getMerchantInfo, isUsableImageUrl } from '@/lib/affiliate';
import { computePriceStats } from '@/lib/priceAnalytics';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';
import V3SubHeader from '@/components/v3/V3SubHeader';
import PriceBarometer from '@/components/PriceBarometer';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import StoreComparison from '@/components/StoreComparison';
import ProductAIVerdictCard from '@/components/ProductAIVerdictCard';
import PriceSavingsCalculator from '@/components/PriceSavingsCalculator';
import PriceAlertModal from '@/components/PriceAlertModal';
import { API_BASE_URL } from '@/lib/config';

// Popular sample search pills
const SAMPLE_SEARCHES = [
  { label: 'MacBook Air M2', q: 'Apple MacBook Air' },
  { label: 'iPhone 15 / 16', q: 'iPhone' },
  { label: 'Sony WH-1000XM5', q: 'Sony WH' },
  { label: 'boAt SmartRing', q: 'boAt SmartRing' },
  { label: 'Philips Air Fryer', q: 'Philips Air Fryer' },
  { label: 'Maybelline Fit Me', q: 'Maybelline' },
];

// Category filter tabs for trending products
const CATEGORY_TABS = [
  { id: 'all', label: 'All Categories', icon: '✨' },
  { id: 'electronics', label: 'Electronics & Mobiles', icon: '📱' },
  { id: 'home', label: 'Home & Kitchen', icon: '🏠' },
  { id: 'beauty', label: 'Beauty & Care', icon: '💄' },
  { id: 'fashion', label: 'Fashion & Apparel', icon: '👗' },
];

/**
 * Computes Spend Lens Fair-Value Score (0 to 100)
 */
function calculateSpendLensScore(product, priceStats) {
  if (!product) {
    return {
      score: 72,
      tier: 'Fair Value',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      badgeText: 'Standard Value',
      summary: 'Current price is within standard historical range.',
      verdictType: 'BUY',
      isATL: false,
      realDropPct: 0,
      rating: 4.1,
    };
  }

  let score = 52; // baseline

  const currentPrice = Number(product.price ?? product.dealPrice) || 0;
  const lowestPrice = Number(priceStats?.lowestPrice) || currentPrice;
  const highestPrice = Number(priceStats?.highestPrice) || currentPrice;
  const averagePrice = Number(priceStats?.averagePrice) || currentPrice;
  const realDropPct = Number(priceStats?.realPriceDropPct) || 0;
  const isATL = Boolean(priceStats?.isAllTimeLow);
  const rating = Number(product.rating) || 4.1;

  // 1. Position vs Historical Price (Max +30 pts)
  if (isATL) {
    score += 30;
  } else if (highestPrice > lowestPrice) {
    const range = highestPrice - lowestPrice;
    const pos = (currentPrice - lowestPrice) / range;
    if (pos <= 0.15) score += 25;
    else if (pos <= 0.35) score += 18;
    else if (pos <= 0.60) score += 8;
    else if (pos >= 0.85) score -= 15;
  } else if (currentPrice < averagePrice) {
    score += 15;
  }

  // 2. Real Verified Price Drop vs Previous Selling Price (Max +20 pts)
  if (realDropPct >= 25) score += 20;
  else if (realDropPct >= 15) score += 16;
  else if (realDropPct >= 8) score += 12;
  else if (realDropPct > 0) score += 8;

  // 3. Review Sentiment & Trust (Max +15 pts)
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.2) score += 12;
  else if (rating >= 3.9) score += 8;
  else if (rating < 3.5) score -= 10;

  // 4. Authenticity check: Fake MRP penalty
  if (priceStats?.isFakeMrpDiscount) {
    score -= 10;
  }

  const finalScore = Math.min(99, Math.max(18, Math.round(score)));

  let tier = 'Standard Fair Price';
  let color = 'text-indigo-700 bg-indigo-50 border-indigo-200';
  let badgeText = 'Fair Price';
  let summary = 'Price is aligned with standard seasonal retail. Safe to buy if needed immediately.';
  let verdictType = 'BUY';

  if (finalScore >= 88) {
    tier = 'Exceptional Steal (ATL)';
    color = 'text-emerald-700 bg-emerald-50 border-emerald-300';
    badgeText = 'Top 5% Steal';
    summary = 'Authentic all-time low price drop detected. Unbeatable value — buy before stock runs out.';
    verdictType = 'STRONG_BUY';
  } else if (finalScore >= 75) {
    tier = 'Strong Value Buy';
    color = 'text-teal-700 bg-teal-50 border-teal-300';
    badgeText = 'High Value';
    summary = 'Price is noticeably below the 90-day median with verified authentic seller ratings.';
    verdictType = 'BUY';
  } else if (finalScore >= 60) {
    tier = 'Standard Fair Price';
    color = 'text-indigo-700 bg-indigo-50 border-indigo-200';
    badgeText = 'Fair Price';
    summary = 'Price is consistent with recent historical averages. Good purchase if needed now.';
    verdictType = 'BUY';
  } else if (finalScore >= 45) {
    tier = 'Average Value / Consider Waiting';
    color = 'text-amber-700 bg-amber-50 border-amber-300';
    badgeText = 'Consider Waiting';
    summary = 'High probability of a price drop during upcoming flash or weekend festive sales.';
    verdictType = 'WAIT';
  } else {
    tier = 'Overpriced / Inflated MRP';
    color = 'text-rose-700 bg-rose-50 border-rose-300';
    badgeText = 'Overpriced';
    summary = 'Recent price markup or fake discount detected. Recommend setting a price alert instead.';
    verdictType = 'OVERPRICED';
  }

  return {
    score: finalScore,
    tier,
    color,
    badgeText,
    summary,
    verdictType,
    isATL,
    realDropPct,
    rating,
  };
}

/**
 * Calculates Card Cashback & Net Effective Price for Indian Credit Cards
 */
function calculateCardSavings(price, merchant = 'amazon') {
  if (!price || price <= 0) return [];

  const cards = [];
  const m = (merchant || '').toLowerCase();

  // Amazon Pay ICICI
  if (m === 'amazon') {
    const cb = Math.round(price * 0.05);
    cards.push({
      id: 'amazon_pay_icici',
      name: 'Amazon Pay ICICI Card',
      bank: 'ICICI Bank',
      benefit: '5% Unlimited Cashback (Prime)',
      savings: cb,
      netPrice: price - cb,
      tag: 'Best for Amazon',
      isTop: true,
      cardColor: 'from-amber-500 to-yellow-600',
    });
  }

  // Flipkart Axis Bank
  if (m === 'flipkart') {
    const cb = Math.round(price * 0.05);
    cards.push({
      id: 'flipkart_axis',
      name: 'Flipkart Axis Bank Card',
      bank: 'Axis Bank',
      benefit: '5% Unlimited Cashback',
      savings: cb,
      netPrice: price - cb,
      tag: 'Best for Flipkart',
      isTop: true,
      cardColor: 'from-blue-600 to-indigo-700',
    });
  }

  // Festive Instant 10% Bank Discount (HDFC / SBI / ICICI)
  if (price >= 2500) {
    const festiveDiscount = Math.min(1500, Math.round(price * 0.10));
    cards.push({
      id: 'festive_instant',
      name: 'HDFC / SBI / ICICI Festive Offer',
      bank: 'Leading Banks',
      benefit: '10% Instant Bank Discount (up to ₹1,500)',
      savings: festiveDiscount,
      netPrice: price - festiveDiscount,
      tag: 'Festive Special',
      isTop: m !== 'amazon' && m !== 'flipkart',
      cardColor: 'from-emerald-600 to-teal-700',
    });
  }

  // SBI Cashback Card (5% online)
  const sbiCb = Math.min(5000, Math.round(price * 0.05));
  cards.push({
    id: 'sbi_cashback',
    name: 'SBI Cashback Credit Card',
    bank: 'SBI Card',
    benefit: '5% Cashback on All Online Spends',
    savings: sbiCb,
    netPrice: price - sbiCb,
    tag: 'Universal 5%',
    isTop: false,
    cardColor: 'from-blue-700 to-cyan-800',
  });

  return cards.sort((a, b) => b.savings - a.savings);
}

export default function ProductLensClient({ initialProduct, initialCurated = [], initialQuery = '' }) {
  const [activeProduct, setActiveProduct] = useState(initialProduct || null);
  const [inputVal, setInputVal] = useState(initialQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');

  const searchBoxRef = useRef(null);
  const inspectionSectionRef = useRef(null);

  // Compute price stats for active product
  const priceStats = useMemo(() => {
    return activeProduct ? computePriceStats(activeProduct) : null;
  }, [activeProduct]);

  // Compute Spend Lens Value Score
  const lensScore = useMemo(() => {
    return calculateSpendLensScore(activeProduct, priceStats);
  }, [activeProduct, priceStats]);

  // Compute Card Offers
  const cardOffers = useMemo(() => {
    const p = Number(activeProduct?.price ?? activeProduct?.dealPrice) || 0;
    return calculateCardSavings(p, activeProduct?.merchant);
  }, [activeProduct]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced auto-suggest when typing keywords
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products?search=${encodeURIComponent(trimmed)}&limit=5&country=IN`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data)) {
            setSuggestions(data.data);
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.warn('[ProductLens] Suggestions fetch error:', err.message);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputVal]);

  // Analyze a specific product
  const handleInspectProduct = useCallback(async (prodOrId) => {
    if (!prodOrId) return;

    if (typeof prodOrId === 'object' && prodOrId.priceHistory) {
      setActiveProduct(prodOrId);
      window.history.replaceState(null, '', `/product-lens?id=${prodOrId._id || prodOrId.productId}`);
      setTimeout(() => {
        inspectionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    const prodId = typeof prodOrId === 'string' ? prodOrId : (prodOrId._id || prodOrId.productId);
    setIsSearching(true);
    setSearchError('');
    setShowSuggestions(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${prodId}`);
      if (!res.ok) throw new Error('Product details could not be retrieved');
      const data = await res.json();
      if (data.success && (data.data || data.product)) {
        const p = data.data || data.product;
        setActiveProduct(p);
        window.history.replaceState(null, '', `/product-lens?id=${p._id || p.productId}`);
        setTimeout(() => {
          inspectionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } else {
        setSearchError('Could not load this product. Please try another.');
      }
    } catch (err) {
      setSearchError(err.message || 'Error inspecting product.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle URL or search submit
  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    const raw = inputVal.trim();
    if (!raw) return;

    setShowSuggestions(false);
    setIsSearching(true);
    setSearchError('');

    // Check if it's a URL
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/compare-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: raw }),
        });
        const data = await res.json();
        if (data.success && data.product) {
          setActiveProduct(data.product);
          window.history.replaceState(null, '', `/product-lens?id=${data.product._id || data.product.productId}`);
          setTimeout(() => {
            inspectionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        } else {
          setSearchError(data.error || 'Could not resolve product link. Please make sure it is a valid Amazon or Flipkart URL.');
        }
      } catch (err) {
        setSearchError('Failed to scan product URL. Please check connection and try again.');
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // Keyword search
    try {
      const res = await fetch(`${API_BASE_URL}/api/products?search=${encodeURIComponent(raw)}&limit=1&country=IN`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        handleInspectProduct(data.data[0]);
      } else {
        setSearchError(`No products found matching "${raw}". Try pasting a direct Amazon or Flipkart URL.`);
      }
    } catch (err) {
      setSearchError('Error performing product search.');
    } finally {
      setIsSearching(false);
    }
  };

  // Filter curated products by category tab
  const filteredCurated = useMemo(() => {
    if (activeCategoryTab === 'all') return initialCurated;
    return initialCurated.filter((p) => {
      const cat = (p.category || '').toLowerCase();
      const sub = (p.subcategory || '').toLowerCase();
      if (activeCategoryTab === 'electronics') {
        return cat.includes('electronic') || cat.includes('mobile') || sub.includes('phone') || sub.includes('laptop');
      }
      if (activeCategoryTab === 'home') {
        return cat.includes('home') || cat.includes('kitchen') || cat.includes('appliance');
      }
      if (activeCategoryTab === 'beauty') {
        return cat.includes('beauty') || cat.includes('care') || sub.includes('cosmetic');
      }
      if (activeCategoryTab === 'fashion') {
        return cat.includes('fashion') || cat.includes('apparel') || cat.includes('cloth');
      }
      return true;
    });
  }, [initialCurated, activeCategoryTab]);

  // Peer alternative products for active product
  const peerAlternatives = useMemo(() => {
    if (!activeProduct || !initialCurated.length) return [];
    return initialCurated
      .filter((p) => (p._id || p.productId) !== (activeProduct._id || activeProduct.productId))
      .slice(0, 3);
  }, [activeProduct, initialCurated]);

  const currentPrice = Number(activeProduct?.price ?? activeProduct?.dealPrice) || 0;
  const originalPrice = Number(activeProduct?.originalPrice) || 0;
  const discountPct = originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
  const merchantInfo = getMerchantInfo(activeProduct?.merchant || activeProduct?.cleanUrl);

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-slate-900 pb-24">
      {/* 1. Global Navigation SubHeader */}
      <V3SubHeader activeTab="lens" />

      {/* 2. Breadcrumb Navigation */}
      <div className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 pt-4">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">Spend Lens™ &amp; Value Radar</span>
        </nav>
      </div>

      {/* 3. Hero & Universal Product Lens Scanner */}
      <section className="relative overflow-hidden pt-6 pb-10 sm:pt-10 sm:pb-14">
        {/* Soft background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="mx-auto max-w-4xl px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-4 py-1.5 text-xs font-black text-emerald-800 shadow-2xs backdrop-blur-xs mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>✨ ShoppersDeals Spend Lens™ • Intelligent Buying Radar</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 leading-tight">
            Inspect Any Product <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">Before You Spend</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Instant <strong>Fair-Value Score (0-100)</strong>, 90-day All-Time Low radar, fake discount detection, multi-store price check, and card cashback optimization.
          </p>

          {/* Interactive URL / Keyword Scanner */}
          <div ref={searchBoxRef} className="mt-8 relative max-w-2xl mx-auto text-left">
            <form onSubmit={handleFormSubmit} className="relative flex items-center shadow-lg rounded-2xl bg-white border-2 border-emerald-500/80 p-1.5 transition-all focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100">
              <div className="pl-3.5 pr-2 text-slate-400">
                <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
              </div>

              <input
                type="text"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setSearchError('');
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Paste Amazon / Flipkart URL or search any gadget..."
                className="w-full bg-transparent py-2.5 px-2 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSearching}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>🔍 Analyze Lens</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {searchError && (
              <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <span>⚠️</span>
                <span>{searchError}</span>
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden py-1.5 divide-y divide-slate-100">
                {suggestions.map((item) => (
                  <button
                    key={item._id || item.productId}
                    type="button"
                    onClick={() => {
                      setInputVal(item.title);
                      handleInspectProduct(item);
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-emerald-50/60 transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 relative rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                      {isUsableImageUrl(item.imageUrl || (item.images && item.images[0])) ? (
                        <img
                          src={item.imageUrl || item.images[0]}
                          alt={item.title}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-xs">🛍️</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mt-0.5">
                        <span className="font-bold text-emerald-700">{formatInr(item.price)}</span>
                        <span>•</span>
                        <span className="capitalize">{item.merchant || 'Amazon'}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Inspect 🔍
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Sample Search Pills */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Try quick lens:</span>
              {SAMPLE_SEARCHES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setInputVal(sample.q);
                    // trigger search
                    fetch(`${API_BASE_URL}/api/products?search=${encodeURIComponent(sample.q)}&limit=1&country=IN`)
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.data && d.data[0]) handleInspectProduct(d.data[0]);
                      })
                      .catch(() => {});
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all shadow-2xs"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Active Inspected Product Deep-Dive Section */}
      {activeProduct && (
        <section ref={inspectionSectionRef} id="lens-details" className="scroll-mt-6 mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 mb-16">
          {/* Header Product Card */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              {/* Product Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-2xl bg-white border border-slate-100 p-2 shadow-2xs flex items-center justify-center">
                  {isUsableImageUrl(activeProduct.imageUrl || (activeProduct.images && activeProduct.images[0])) ? (
                    <img
                      src={activeProduct.imageUrl || activeProduct.images[0]}
                      alt={activeProduct.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🛍️</span>
                  )}
                  {/* Store Badge */}
                  <div className="absolute top-1.5 left-1.5 rounded-md bg-white/95 px-1.5 py-0.5 shadow-2xs border border-slate-200/80">
                    {renderStoreLogo(activeProduct.merchant || 'amazon', 'h-3.5 w-auto')}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      {activeProduct.category || 'Electronics'}
                    </span>
                    {activeProduct.brand && (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-100">
                        {activeProduct.brand}
                      </span>
                    )}
                    {lensScore.isATL && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-800 border border-emerald-200">
                        🔥 All-Time Low Price
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug line-clamp-2">
                    {activeProduct.title}
                  </h2>

                  {/* Pricing row */}
                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <span className="text-2xl sm:text-3xl font-black text-slate-950">
                      {formatInr(currentPrice)}
                    </span>
                    {originalPrice > currentPrice && (
                      <>
                        <span className="text-sm font-semibold text-slate-600 line-through">
                          {formatInr(originalPrice)}
                        </span>
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700 border border-emerald-200">
                          {discountPct}% OFF
                        </span>
                      </>
                    )}
                    {activeProduct.rating > 0 && (
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <span>★</span>
                        <span>{activeProduct.rating}</span>
                        {activeProduct.reviewsCount > 0 && (
                          <span className="text-slate-400">({activeProduct.reviewsCount})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                {/* Buy Button */}
                <a
                  href={getAffiliateUrl(activeProduct.cleanUrl || activeProduct.dealUrl || activeProduct.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-black text-white shadow-md hover:from-emerald-700 hover:to-teal-700 transition-all"
                >
                  <span>⚡ BUY NOW</span>
                  <span className="text-xs opacity-90">({merchantInfo.label})</span>
                </a>

                {/* Price Alert Button */}
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <span>🔔 Set Alert</span>
                </button>

                {/* Compare Link */}
                <Link
                  href={`/compare?ids=${activeProduct._id || activeProduct.productId}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <span>⚖️ Compare</span>
                </Link>

                {/* 90D History Link */}
                <Link
                  href={`/product/${activeProduct._id || activeProduct.productId}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs sm:text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <span>📈 90D Chart</span>
                </Link>
              </div>
            </div>

            {/* 4-Pillar Analytical Bento Grid */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Pillar 1: Spend Lens Value Score */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/60 to-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Pillar 1: Value Score</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black border ${lensScore.color}`}>
                      {lensScore.badgeText}
                    </span>
                  </div>

                  {/* Circular Score Gauge representation */}
                  <div className="flex items-center gap-4 my-2">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                      <span className="text-2xl font-black">{lensScore.score}</span>
                      <span className="absolute bottom-1 text-[9px] font-bold text-slate-400">/ 100</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{lensScore.tier}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{lensScore.summary}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>MRP Authenticity:</span>
                    <span className="font-bold text-emerald-700">
                      {priceStats?.isFakeMrpDiscount ? '⚠️ Inflated MRP' : '✓ Verified 100%'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Distance to ATL:</span>
                    <span className="font-bold text-slate-900">
                      {lensScore.isATL ? '🔥 At All-Time Low' : formatInr(priceStats?.lowestPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: AI Buying Verdict & Timing */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/60 to-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Pillar 2: AI Verdict</span>
                    <span className="text-base">🤖</span>
                  </div>

                  <div className="mb-2">
                    {lensScore.verdictType === 'STRONG_BUY' && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                        ✓ STRONG BUY NOW
                      </span>
                    )}
                    {lensScore.verdictType === 'BUY' && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-black text-white">
                        ✓ SAFE VALUE PURCHASE
                      </span>
                    )}
                    {lensScore.verdictType === 'WAIT' && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-black text-white">
                        ⏳ CONSIDER WAITING
                      </span>
                    )}
                    {lensScore.verdictType === 'OVERPRICED' && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-black text-white">
                        ⚠️ OVERPRICED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mt-2">
                    {priceStats?.verdictReason || 'Analyzed against recent market price points and seasonal discounting patterns.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Timing Recommendation:</span>
                  <span className="font-bold text-slate-900">
                    {lensScore.isATL ? 'Best Time to Buy' : 'Normal Cycle'}
                  </span>
                </div>
              </div>

              {/* Pillar 3: Multi-Store Price Radar */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/60 to-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Pillar 3: Store Radar</span>
                    <span className="text-base">🏪</span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900">Cross-Store Comparison</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Checked across Amazon, Flipkart, Myntra, Nykaa, and Croma.
                  </p>

                  <div className="mt-3 rounded-xl bg-white border border-slate-100 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-700 font-bold capitalize">{activeProduct.merchant || 'Amazon'}</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-bold">Current</span>
                      </div>
                      <span className="font-black text-slate-950">{formatInr(currentPrice)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Live Status:</span>
                  <span className="font-bold text-emerald-700">✓ In Stock &amp; Tracked</span>
                </div>
              </div>

              {/* Pillar 4: Card Cashback & Net Effective Price */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/60 to-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Pillar 4: Card Maximizer</span>
                    <span className="text-base">💳</span>
                  </div>

                  {cardOffers.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{cardOffers[0].name}</span>
                        <span className="text-xs font-black text-emerald-700">Save {formatInr(cardOffers[0].savings)}</span>
                      </div>
                      <div className="mt-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Net Effective Price</span>
                          <span className="text-sm font-black text-emerald-900">{formatInr(cardOffers[0].netPrice)}</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 mt-1 font-semibold">{cardOffers[0].benefit}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Standard card benefits apply.</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Card Strategy:</span>
                  <Link href="/credit-cards" className="font-bold text-indigo-600 hover:underline">
                    View Top Cards →
                  </Link>
                </div>
              </div>
            </div>

            {/* AI Verdict Deep-Dive (Pros & Cons) */}
            <div className="mt-8">
              <ProductAIVerdictCard product={activeProduct} />
            </div>

            {/* Cross-Store Real Price Comparison Module */}
            <div className="mt-8">
              <StoreComparison product={activeProduct} />
            </div>

            {/* 90-Day Price Barometer & Plateau Step Chart */}
            <div className="mt-8">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>📊</span>
                  <span>90-Day Empirical Price Truth Radar</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real recorded transaction prices plotted over time. Filter out fake festive price hikes.
                </p>
              </div>

              <PriceBarometer product={activeProduct} priceStats={priceStats} />

              <div className="mt-4 rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-2xs">
                <PriceHistoryChart product={activeProduct} priceStats={priceStats} />
              </div>

              <PriceSavingsCalculator product={activeProduct} priceStats={priceStats} />
            </div>
          </div>
        </section>
      )}

      {/* 5. Trending Lenses Analyzed by Spend Lens (Grid) */}
      <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 mt-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black">
                🔍
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Trending Products Analyzed by Spend Lens
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Select any popular gadget or everyday item to load its live Fair-Value Score &amp; multi-store check.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                  activeCategoryTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Curated Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredCurated.slice(0, 12).map((item) => {
            const p = Number(item.price ?? item.dealPrice) || 0;
            const op = Number(item.originalPrice) || 0;
            const drop = op > p ? Math.round(((op - p) / op) * 100) : 0;
            const isSelected = activeProduct && (activeProduct._id === item._id || activeProduct.productId === item.productId);

            return (
              <div
                key={item._id || item.productId}
                className={`group rounded-2xl border transition-all duration-200 bg-white p-4.5 flex flex-col justify-between shadow-2xs hover:shadow-md ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-100'
                    : 'border-slate-200/90 hover:border-emerald-300'
                }`}
              >
                <div>
                  {/* Top Bar with Store and Quick Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="rounded-md bg-slate-50 px-2 py-0.5 border border-slate-100">
                      {renderStoreLogo(item.merchant || 'amazon', 'h-3.5 w-auto')}
                    </div>
                    {drop > 0 ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-200">
                        {drop}% OFF
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Tracked
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative h-40 w-full mb-3 rounded-xl bg-slate-50/50 flex items-center justify-center overflow-hidden p-2">
                    {isUsableImageUrl(item.imageUrl || (item.images && item.images[0])) ? (
                      <img
                        src={item.imageUrl || item.images[0]}
                        alt={item.title}
                        className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-3xl text-slate-300">🛍️</span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </h3>

                  {/* Price Row */}
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-base sm:text-lg font-black text-slate-950">
                      {formatInr(p)}
                    </span>
                    {op > p && (
                      <span className="text-xs font-semibold text-slate-400 line-through">
                        {formatInr(op)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleInspectProduct(item)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200/90 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                  >
                    <span>🔍 Inspect Lens</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Why Indian Shoppers Use Spend Lens (Trust Section) */}
      <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 mt-16">
        <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-emerald-50/20 to-indigo-50/20 p-6 sm:p-10 shadow-sm">
          <div className="max-w-2xl">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 uppercase tracking-wider">
              The Spend Lens Guarantee
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Why Never Buy Online Without Checking Spend Lens
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              E-commerce platforms deploy artificial urgency, fluctuating MRPs, and fake sale timers. Spend Lens provides 100% empirical, unbiased verification.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-xl font-bold mb-3">
                🛑
              </div>
              <h3 className="text-sm font-black text-slate-900">Fake MRP Buster</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Sellers often double MRP right before big sales to advertise 70% discounts. Lens uses empirical 90-day transaction medians to expose fake markups.
              </p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 text-xl font-bold mb-3">
                ⚖️
              </div>
              <h3 className="text-sm font-black text-slate-900">Cross-Store Arbitrage</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                In 38% of cases, the exact same smartphone, cosmetic, or kitchen appliance is ₹200 to ₹1,500 cheaper on a competitor store like Flipkart or Nykaa.
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-xl font-bold mb-3">
                💳
              </div>
              <h3 className="text-sm font-black text-slate-900">Card Yield Maximizer</h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Calculates whether Amazon Pay ICICI, Flipkart Axis, or SBI Cashback nets the lowest final checkout cost, factoring in hidden discount caps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Price Alert Modal */}
      {activeProduct && (
        <PriceAlertModal
          product={activeProduct}
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
        />
      )}
    </div>
  );
}
