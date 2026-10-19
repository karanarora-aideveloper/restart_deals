'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import V3DealCard from './V3DealCard';
import { getSavedDeals } from '@/lib/savedDeals';
import { API_BASE_URL } from '@/lib/config';
import { isUsableImageUrl } from '@/lib/affiliate';
import {
  AmazonLogo,
  FlipkartLogo,
  MyntraLogo,
  ShopsyLogo,
  NykaaLogo,
  AjioLogo,
  MeeshoLogo,
  CromaLogo,
  BlinkitLogo,
} from '@/components/BrandAndStoreLogos';
import { recordClientInteraction } from '@/lib/personalization';

function sortDealsByDealTime(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.postedAt || a.updatedAt || a.lastVerifiedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.postedAt || b.updatedAt || b.lastVerifiedAt || 0).getTime();
    return timeB - timeA;
  });
}

const CATEGORIES = [
  { id: 'all', label: 'All Deals', icon: '⚡' },
  { id: 'mobiles', label: 'Mobiles', icon: '📱' },
  { id: 'electronics', label: 'Tech & Audio', icon: '🎧' },
  { id: 'appliances', label: 'Appliances', icon: '🔌' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'beauty', label: 'Beauty & Care', icon: '💄' },
  { id: 'home', label: 'Home & Kitchen', icon: '🏠' },
  { id: 'laptops', label: 'Laptops', icon: '💻' },
  { id: 'fitness', label: 'Gym & Fitness', icon: '🏋️' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
];

const DISCOUNT_BANDS = [
  { id: 0, label: 'All Drops' },
  { id: 20, label: '20%+ Drop' },
  { id: 30, label: '30%+ Drop' },
  { id: 50, label: '🔥 50%+ Loot' },
  { id: 70, label: '💎 70%+ Deep Loot' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: '⚡ Latest Live' },
  { id: 'discount', label: '🔥 Highest % Off' },
  { id: 'price_asc', label: '🏷️ Price: Low to High' },
  { id: 'price_desc', label: '💎 Price: High to Low' },
];

const PRIMARY_STORES = [
  { id: 'all', label: 'All Stores', icon: '🏪' },
  { id: 'amazon', label: 'Amazon', component: <AmazonLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'flipkart', label: 'Flipkart', component: <FlipkartLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'myntra', label: 'Myntra', component: <MyntraLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'nykaa', label: 'Nykaa', component: <NykaaLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'ajio', label: 'Ajio', component: <AjioLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'meesho', label: 'Meesho', component: <MeeshoLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'croma', label: 'Croma', component: <CromaLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'shopsy', label: 'Shopsy', component: <ShopsyLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
  { id: 'blinkit', label: 'Blinkit', component: <BlinkitLogo className="h-3.5 sm:h-4 w-auto object-contain" /> },
];

const D2C_STORES = [
  { id: 'boat', label: 'boAt Lifestyle', icon: '🎧' },
  { id: 'mamaearth', label: 'Mamaearth', icon: '🌱' },
  { id: 'plum', label: 'Plum Goodness', icon: '🌿' },
  { id: 'thedermaco', label: 'The Derma Co', icon: '🔬' },
  { id: 'mcaffeine', label: 'mCaffeine', icon: '☕' },
  { id: 'dotandkey', label: 'Dot & Key', icon: '✨' },
  { id: 'sugar', label: 'SUGAR Cosmetics', icon: '💄' },
  { id: 'minimalist', label: 'Minimalist', icon: '🧪' },
  { id: 'noise', label: 'Noise', icon: '⌚' },
  { id: 'snitch', label: 'Snitch', icon: '👔' },
];

const SOURCE_MODES = [
  { id: 'all', label: '⚡ All Live Deals' },
  { id: 'engine1', label: '⚡ Flash Radar Drops' },
  { id: 'engine2', label: '🤖 24/7 Store Watcher' },
];

export default function V3FeedContainer({
  initialDeals = [],
  initialHasMore = false,
  category = 'all',
  merchant = 'all',
  country = 'in',
  initialSort = 'newest',
  initialMinDiscount = 0,
  userProfile = null,
}) {
  const [deals, setDeals] = useState(() => (userProfile?.hasHistory || initialSort !== 'newest' ? initialDeals : sortDealsByDealTime(initialDeals)));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Dynamic Category & Store ordering based on personalization cookie
  const displayCategories = React.useMemo(() => {
    if (!userProfile?.c || Object.keys(userProfile.c).length === 0) {
      return CATEGORIES;
    }
    const allCat = CATEGORIES.find((c) => c.id === 'all');
    const otherCats = CATEGORIES.filter((c) => c.id !== 'all');
    const sorted = [...otherCats].sort((a, b) => {
      const scoreA = userProfile.c[a.id] || 0;
      const scoreB = userProfile.c[b.id] || 0;
      return scoreB - scoreA;
    });
    return [allCat, ...sorted];
  }, [userProfile?.c]);

  const displayStores = React.useMemo(() => {
    if (!userProfile?.s || Object.keys(userProfile.s).length === 0) {
      return PRIMARY_STORES;
    }
    const allStore = PRIMARY_STORES.find((s) => s.id === 'all');
    const otherStores = PRIMARY_STORES.filter((s) => s.id !== 'all');
    const sorted = [...otherStores].sort((a, b) => {
      const scoreA = userProfile.s[a.id] || 0;
      const scoreB = userProfile.s[b.id] || 0;
      return scoreB - scoreA;
    });
    return [allStore, ...sorted];
  }, [userProfile?.s]);

  // Filter States
  const [activeCategory, setActiveCategory] = useState(category);
  const [activeStore, setActiveStore] = useState(merchant || 'all');
  const [minDiscount, setMinDiscount] = useState(initialMinDiscount || 0);
  const [activeSort, setActiveSort] = useState(initialSort || 'newest');
  const [activeEngine, setActiveEngine] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showD2cDrawer, setShowD2cDrawer] = useState(false);
  const [savedDeals, setSavedDeals] = useState([]);

  useEffect(() => {
    setSavedDeals(getSavedDeals());
  }, []);

  useEffect(() => {
    setDeals(userProfile?.hasHistory || initialSort !== 'newest' ? initialDeals : sortDealsByDealTime(initialDeals));
    setHasMore(initialHasMore);
  }, [initialDeals, initialHasMore, initialSort, userProfile?.hasHistory]);

  // Synchronize when server props change
  const prevMerchantRef = useRef(merchant);
  useEffect(() => {
    if (prevMerchantRef.current !== merchant) {
      prevMerchantRef.current = merchant;
      setActiveStore(merchant || 'all');
    }
  }, [merchant]);

  const prevCategoryRef = useRef(category);
  useEffect(() => {
    if (prevCategoryRef.current !== category) {
      prevCategoryRef.current = category;
      setActiveCategory(category || 'all');
    }
  }, [category]);

  // Sync state to browser URL without full reloads
  const updateUrlParams = (cat, store, minDisc, sortVal, engine, q) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (cat && cat !== 'all') url.searchParams.set('category', cat);
    else url.searchParams.delete('category');

    if (store && store !== 'all') url.searchParams.set('merchant', store);
    else url.searchParams.delete('merchant');

    if (minDisc && minDisc > 0) url.searchParams.set('minDiscount', String(minDisc));
    else url.searchParams.delete('minDiscount');

    if (sortVal && sortVal !== 'newest') url.searchParams.set('sort', sortVal);
    else url.searchParams.delete('sort');

    if (engine && engine !== 'all') url.searchParams.set('sourceEngine', engine);
    else url.searchParams.delete('sourceEngine');

    if (q && q.trim()) url.searchParams.set('q', q.trim());
    else url.searchParams.delete('q');

    window.history.replaceState(null, '', url.pathname + url.search);
  };

  // Central fetch with all multi-dimensional filters
  const fetchFilteredDeals = useCallback(
    async (
      cat = activeCategory,
      store = activeStore,
      minDisc = minDiscount,
      engine = activeEngine,
      sortVal = activeSort,
      targetPage = 1,
      append = false,
      querySearch = debouncedQuery
    ) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          country: 'in',
          page: targetPage.toString(),
          limit: '24',
          sort: sortVal || 'newest',
        });

        if (cat && cat !== 'all') params.set('category', cat);
        if (store && store !== 'all') params.set('merchant', store);
        if (minDisc && minDisc > 0) params.set('minDiscount', minDisc.toString());
        if (engine && engine !== 'all') params.set('sourceEngine', engine);
        if (querySearch && querySearch.trim()) params.set('q', querySearch.trim());

        let res;
        try {
          res = await fetch(`/api/deals?${params.toString()}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);
        } catch {
          res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
        }
        if (!res.ok) throw new Error('Failed to fetch deals');
        const data = await res.json();
        const rawList = data.data || data.deals || data.items || [];
        const usableList = rawList.filter((d) => isUsableImageUrl(d.imageUrl));
        const newItems = sortVal === 'newest' ? sortDealsByDealTime(usableList) : usableList;

        if (append) {
          setDeals((prev) => (sortVal === 'newest' ? sortDealsByDealTime([...prev, ...newItems]) : [...prev, ...newItems]));
        } else {
          setDeals(newItems);
        }
        setHasMore(Boolean(data.pagination ? targetPage < data.pagination.pages : rawList.length >= 24));
        setPage(targetPage);
      } catch (err) {
        console.error('[V3FeedContainer Fetch Error]', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory, activeStore, minDiscount, activeEngine, activeSort, debouncedQuery]
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== debouncedQuery) {
        setDebouncedQuery(searchInput);
        fetchFilteredDeals(activeCategory, activeStore, minDiscount, activeEngine, activeSort, 1, false, searchInput);
        updateUrlParams(activeCategory, activeStore, minDiscount, activeSort, activeEngine, searchInput);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedQuery, activeCategory, activeStore, minDiscount, activeEngine, activeSort, fetchFilteredDeals]);

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    if (catId && catId !== 'all') {
      recordClientInteraction({ type: 'filter_click', category: catId });
    }
    updateUrlParams(catId, activeStore, minDiscount, activeSort, activeEngine, debouncedQuery);
    fetchFilteredDeals(catId, activeStore, minDiscount, activeEngine, activeSort, 1, false, debouncedQuery);
  };

  const handleStoreChange = (storeId) => {
    const nextStore = activeStore === storeId && storeId !== 'all' ? 'all' : storeId;
    setActiveStore(nextStore);
    if (nextStore && nextStore !== 'all') {
      recordClientInteraction({ type: 'filter_click', merchant: nextStore });
    }
    updateUrlParams(activeCategory, nextStore, minDiscount, activeSort, activeEngine, debouncedQuery);
    fetchFilteredDeals(activeCategory, nextStore, minDiscount, activeEngine, activeSort, 1, false, debouncedQuery);
  };

  const handleDiscountChange = (disc) => {
    const nextDisc = minDiscount === disc && disc !== 0 ? 0 : disc;
    setMinDiscount(nextDisc);
    updateUrlParams(activeCategory, activeStore, nextDisc, activeSort, activeEngine, debouncedQuery);
    fetchFilteredDeals(activeCategory, activeStore, nextDisc, activeEngine, activeSort, 1, false, debouncedQuery);
  };

  const handleSortChange = (newSort) => {
    setActiveSort(newSort);
    updateUrlParams(activeCategory, activeStore, minDiscount, newSort, activeEngine, debouncedQuery);
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, activeEngine, newSort, 1, false, debouncedQuery);
  };

  const handleEngineChange = (engineId) => {
    setActiveEngine(engineId);
    updateUrlParams(activeCategory, activeStore, minDiscount, activeSort, engineId, debouncedQuery);
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, engineId, activeSort, 1, false, debouncedQuery);
  };

  const handleResetAll = () => {
    setActiveCategory('all');
    setActiveStore('all');
    setMinDiscount(0);
    setActiveSort('newest');
    setActiveEngine('all');
    setSearchInput('');
    setDebouncedQuery('');
    updateUrlParams('all', 'all', 0, 'newest', 'all', '');
    fetchFilteredDeals('all', 'all', 0, 'all', 'newest', 1, false, '');
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, activeEngine, activeSort, page + 1, true, debouncedQuery);
  };

  const hasActiveFilters =
    activeCategory !== 'all' ||
    activeStore !== 'all' ||
    minDiscount > 0 ||
    activeSort !== 'newest' ||
    activeEngine !== 'all' ||
    debouncedQuery.trim() !== '';

  const activeCategoryObj = CATEGORIES.find((c) => c.id === activeCategory);
  const activeStoreObj =
    PRIMARY_STORES.find((s) => s.id === activeStore) || D2C_STORES.find((s) => s.id === activeStore);
  const activeSortObj = SORT_OPTIONS.find((s) => s.id === activeSort);

  return (
    <section id="deals" className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
      {/* 1. Header with Live Pulse Badge */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200/80 px-3 py-1 text-xs font-bold text-indigo-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Live Price-Drop Radar</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-slate-600">Zero Fake Discounts</span>
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#1E1B4B]">
            Verified Price Drops &amp; Genuine Loot Deals
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
            Continuously verified against 90-day selling prices. Filter by category, store, or discount percentage below.
          </p>
          {userProfile?.hasHistory && activeCategory === 'all' && activeStore === 'all' && activeSort === 'newest' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/90 px-2.5 py-0.5 text-[10.5px] font-black text-violet-800 shadow-2xs">
                <span>✨ Personalized Feed (Curated for You)</span>
              </span>
            </div>
          )}
        </div>

        {/* Discovery Engine Selector Dropdown / Pills */}
        <div className="flex items-center gap-1.5 self-start md:self-end bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          {SOURCE_MODES.map((eng) => (
            <button
              key={eng.id}
              onClick={() => handleEngineChange(eng.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all whitespace-nowrap ${
                activeEngine === eng.id
                  ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {eng.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Streamlined Filter Matrix Container */}
      <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs space-y-3.5">
        
        {/* Tier 1: Category Strip & Search / Sort Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Horizontal Rail */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            {displayCategories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const isAffinity = Boolean(userProfile?.c && (userProfile.c[cat.id] || 0) >= 3);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all shrink-0 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#5855E5] text-white shadow-xs ring-2 ring-indigo-300'
                      : isAffinity
                      ? 'bg-indigo-50/70 text-indigo-900 border border-indigo-200/90 hover:bg-indigo-100'
                      : 'bg-slate-50 text-slate-700 border border-slate-200/70 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm leading-none">{cat.icon}</span>
                  <span>{cat.label}</span>
                  {isAffinity && cat.id !== 'all' && (
                    <span className="text-[10px] text-indigo-500 font-bold">★</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input + Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Inline Keyword Filter */}
            <div className="relative min-w-[180px] sm:min-w-[210px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search live deals..."
                className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Dropdown Selector */}
            <div className="relative shrink-0">
              <select
                value={activeSort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="appearance-none cursor-pointer rounded-xl border border-slate-200/90 bg-slate-50/70 pl-3 pr-7 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                aria-label="Sort deals"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500 text-[10px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Store Logos Rail & Discount Bands */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Store Logo Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 uppercase tracking-wider">Store:</span>
            {displayStores.map((store) => {
              const isSelected = activeStore === store.id;
              return (
                <button
                  key={store.id}
                  onClick={() => handleStoreChange(store.id)}
                  className={`h-8 rounded-xl px-2.5 text-xs font-extrabold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/50'
                      : 'bg-white border border-slate-200/90 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                  title={`Filter by ${store.label}`}
                >
                  {store.component ? (
                    <span className="flex items-center justify-center shrink-0">{store.component}</span>
                  ) : (
                    <span>{store.icon || store.label}</span>
                  )}
                  {store.id === 'all' && <span>{store.label}</span>}
                </button>
              );
            })}

            {/* D2C Brands Toggle */}
            <button
              onClick={() => setShowD2cDrawer(!showD2cDrawer)}
              className={`h-8 rounded-xl px-2.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 ${
                showD2cDrawer || D2C_STORES.some((d) => d.id === activeStore)
                  ? 'bg-violet-100 text-violet-800 border border-violet-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🌿 D2C Brands</span>
              <span className="text-[10px]">{showD2cDrawer ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Discount % Drop Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 uppercase tracking-wider">Drop:</span>
            {DISCOUNT_BANDS.map((band) => {
              const isSelected = minDiscount === band.id;
              return (
                <button
                  key={band.id}
                  onClick={() => handleDiscountChange(band.id)}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {band.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible D2C Brands Sub-Rail */}
        {showD2cDrawer && (
          <div className="pt-2.5 border-t border-dashed border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-violet-600 shrink-0 mr-1">Direct Brand Stores:</span>
            {D2C_STORES.map((d) => {
              const isSelected = activeStore === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => handleStoreChange(d.id)}
                  className={`h-7 rounded-lg px-2.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? 'bg-violet-700 text-white shadow-xs font-black'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-violet-400 hover:bg-violet-50/40'
                  }`}
                >
                  <span>{d.icon}</span>
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tier 3: Active Filter Chips & Counter Ribbon */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500">Active Filters:</span>
            {activeCategory !== 'all' && (
              <button
                onClick={() => handleCategoryChange('all')}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                title="Remove category filter"
              >
                <span>Category: {activeCategoryObj?.label || activeCategory}</span>
                <span className="text-indigo-400 hover:text-indigo-900">✕</span>
              </button>
            )}
            {activeStore !== 'all' && (
              <button
                onClick={() => handleStoreChange('all')}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                title="Remove store filter"
              >
                <span>Store: {activeStoreObj?.label || activeStore}</span>
                <span className="text-emerald-500 hover:text-emerald-900">✕</span>
              </button>
            )}
            {minDiscount > 0 && (
              <button
                onClick={() => handleDiscountChange(0)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                title="Remove discount filter"
              >
                <span>Min {minDiscount}% Drop</span>
                <span className="text-amber-500 hover:text-amber-900">✕</span>
              </button>
            )}
            {activeSort !== 'newest' && (
              <button
                onClick={() => handleSortChange('newest')}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                title="Reset sort"
              >
                <span>Sort: {activeSortObj?.label || activeSort}</span>
                <span className="text-slate-400 hover:text-slate-900">✕</span>
              </button>
            )}
            {debouncedQuery.trim() && (
              <button
                onClick={() => setSearchInput('')}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                title="Clear keyword search"
              >
                <span>"{debouncedQuery}"</span>
                <span className="text-rose-400 hover:text-rose-900">✕</span>
              </button>
            )}
            <button
              onClick={handleResetAll}
              className="text-xs font-black text-indigo-600 hover:text-indigo-800 hover:underline ml-auto"
            >
              Reset All Filters ✕
            </button>
          </div>
        )}
      </div>

      {/* 3. Dynamic Result Count Bar */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-1.5">
          <span>Showing <strong className="text-slate-900 font-black">{deals.length}</strong> verified price-drop items</span>
          {activeCategory !== 'all' && (
            <span className="hidden sm:inline text-slate-400">in <strong className="text-slate-700 capitalize">{activeCategoryObj?.label || activeCategory}</strong></span>
          )}
          {activeStore !== 'all' && (
            <span className="hidden sm:inline text-slate-400">on <strong className="text-slate-700 capitalize">{activeStoreObj?.label || activeStore}</strong></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchFilteredDeals(activeCategory, activeStore, minDiscount, activeEngine, activeSort, 1, false, debouncedQuery)}
            disabled={loading}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-bold transition-colors disabled:opacity-50"
            title="Refresh verified deals"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span className="hidden sm:inline">Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* 4. Deal Grid Layout */}
      {loading ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-84 rounded-2xl border border-slate-200 bg-white p-3 animate-pulse flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-14 rounded-md bg-slate-200" />
                  <div className="h-4 w-12 rounded-full bg-slate-200" />
                </div>
                <div className="h-36 w-full rounded-xl bg-slate-100 mb-2.5" />
                <div className="h-3.5 w-3/4 rounded-md bg-slate-200 mb-1.5" />
                <div className="h-3.5 w-1/2 rounded-md bg-slate-200 mb-2.5" />
                <div className="h-5 w-full rounded-md bg-slate-100 mb-2" />
                <div className="h-12 w-full rounded-xl bg-slate-50 p-2" />
              </div>
              <div className="h-8 w-full rounded-xl bg-slate-200 mt-2" />
            </div>
          ))}
        </div>
      ) : deals.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {deals.map((deal, idx) => (
            <V3DealCard
              key={deal._id || deal.id || idx}
              deal={deal}
              index={idx}
              savedDeals={savedDeals}
              onSavedChange={setSavedDeals}
            />
          ))}
        </div>
      ) : (
        /* Empty State with Actionable Recommendations */
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl mb-3">
            🔍
          </div>
          <h3 className="text-lg font-black text-slate-900">No matching verified deals found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'No live price drops meet all of your active filter criteria. Try relaxing your discount threshold or switching stores.'
              : 'Our bots are continuously scraping live store prices. Click refresh or explore top categories.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-xl bg-[#5855E5] px-5 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#4743DE] transition-colors"
            >
              Reset All Filters
            </button>
            {minDiscount > 20 && (
              <button
                type="button"
                onClick={() => handleDiscountChange(20)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Try 20%+ Drops
              </button>
            )}
            {activeStore !== 'all' && (
              <button
                type="button"
                onClick={() => handleStoreChange('all')}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Show All Stores
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Load More Pagination Action */}
      {hasMore && !loading && (
        <div className="mt-10 sm:mt-12 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-[#5855E5] px-8 py-3.5 text-sm font-black text-white shadow-md transition-all hover:bg-[#4743DE] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Loading authentic price drops...</span>
              </>
            ) : (
              <>
                <span>Load More Verified Deals</span>
                <span className="text-xs bg-white/20 rounded-md px-1.5 py-0.5">↓</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
