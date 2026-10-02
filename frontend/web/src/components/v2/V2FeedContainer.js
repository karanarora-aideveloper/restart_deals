'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import V2DealCard from './V2DealCard';
import V2DiscountBands from './V2DiscountBands';
import V2StoresSection from './V2StoresSection';
import V2BrandsSection from './V2BrandsSection';
import { API_BASE_URL } from '@/lib/config';
import { isUsableImageUrl } from '@/lib/affiliate';

export default function V2FeedContainer({
  initialDeals = [],
  initialHasMore = true,
  category = 'all',
  country = 'in',
}) {
  const [deals, setDeals] = useState(
    initialDeals.filter((d) => isUsableImageUrl(d.imageUrl || (d.images && d.images[0])))
  );
  const [activeCategory, setActiveCategory] = useState(category);
  const [activeMerchant, setActiveMerchant] = useState('all');
  const [activeBrand, setActiveBrand] = useState('all');
  const [activeMinDiscount, setActiveMinDiscount] = useState(0);
  const [activeSort, setActiveSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sentinelRef = useRef(null);
  const feedTopRef = useRef(null);

  // Sync category when parent prop changes
  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  // Drop deal if its image fails to load in browser
  const handleImageUnavailable = useCallback((dealId) => {
    setDeals((prev) => prev.filter((d) => (d._id || d.id) !== dealId));
  }, []);

  // Fetch when Category or Store changes from API
  const fetchCategoryOrStore = useCallback(async (cat, store) => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '40');
      params.set('country', 'in'); // Strict India filter
      if (cat && cat !== 'all') params.set('category', cat);
      if (store && store !== 'all') params.set('merchant', store);

      const res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
      const data = await res.json();
      const items = (data.deals || data.data || []).filter(
        (d) => isUsableImageUrl(d.imageUrl || (d.images && d.images[0]))
      );
      setDeals(items);
      setPage(1);
      setHasMore(items.length >= 30);
    } catch (err) {
      console.error('[V2FeedContainer Refresh Error]', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleSelectMerchant = (merchantId) => {
    setActiveMerchant(merchantId);
    fetchCategoryOrStore(activeCategory, merchantId);
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectBrand = (brandId) => {
    setActiveBrand(brandId);
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Client-side filtering & sorting for zero-latency filter response
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Filter strictly to Indian deals to prevent random US items
    result = result.filter((d) => (d.country || 'IN').toUpperCase() === 'IN');

    // Filter by merchant
    if (activeMerchant !== 'all') {
      result = result.filter((d) => {
        const m = (d.merchant || d.dealUrl || '').toLowerCase();
        return m.includes(activeMerchant.toLowerCase());
      });
    }

    // Filter by brand
    if (activeBrand !== 'all') {
      result = result.filter((d) => {
        const title = (d.title || '').toLowerCase();
        const brand = (d.brand || '').toLowerCase();
        return title.includes(activeBrand.toLowerCase()) || brand.includes(activeBrand.toLowerCase());
      });
    }

    // Filter by min discount
    if (activeMinDiscount > 0) {
      result = result.filter((d) => {
        const orig = Number(d.originalPrice || 0);
        const cur = Number(d.dealPrice || 0);
        const pct = d.discountPercentage || (orig > cur ? Math.round(((orig - cur) / orig) * 100) : 0);
        return pct >= activeMinDiscount;
      });
    }

    // Sort
    if (activeSort === 'discount') {
      result.sort((a, b) => {
        const pctA = a.discountPercentage || 0;
        const pctB = b.discountPercentage || 0;
        return pctB - pctA;
      });
    } else if (activeSort === 'price_asc') {
      result.sort((a, b) => Number(a.dealPrice || 0) - Number(b.dealPrice || 0));
    } else if (activeSort === 'price_desc') {
      result.sort((a, b) => Number(b.dealPrice || 0) - Number(a.dealPrice || 0));
    } else {
      // Default: newest
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return result;
  }, [deals, activeMerchant, activeBrand, activeMinDiscount, activeSort]);

  // Infinite Scroll loading
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', '40');
      params.set('country', 'in'); // Strict India filter
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (activeMerchant !== 'all') params.set('merchant', activeMerchant);

      const res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
      const data = await res.json();
      const newItems = (data.deals || data.data || []).filter(
        (d) => isUsableImageUrl(d.imageUrl || (d.images && d.images[0]))
      );
      if (newItems.length > 0) {
        setDeals((prev) => {
          const existingIds = new Set(prev.map((i) => i._id || i.id));
          const unique = newItems.filter((i) => !existingIds.has(i._id || i.id));
          return [...prev, ...unique];
        });
        setPage(nextPage);
        setHasMore(newItems.length >= 30);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[V2FeedContainer Load More Error]', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, activeCategory, activeMerchant]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="w-full">
      {/* ═══ SECTION 1: DEALS BY STORES ═══ */}
      <V2StoresSection
        activeMerchant={activeMerchant}
        onSelectMerchant={handleSelectMerchant}
      />

      {/* ═══ SECTION 2: DEALS BY BRANDS ═══ */}
      <V2BrandsSection
        activeBrand={activeBrand}
        onSelectBrand={handleSelectBrand}
      />

      {/* ═══ SECTION 3: LIVE VERIFIED FEED ═══ */}
      <div ref={feedTopRef} className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        {/* Active Filter Tags Bar (if any filter is selected) */}
        {(activeMerchant !== 'all' || activeBrand !== 'all' || activeMinDiscount > 0) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-orange-50/70 border border-orange-200/80 px-4 py-2 text-xs">
            <span className="font-extrabold text-brand">Active Filters:</span>
            {activeMerchant !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-bold text-slate-800 shadow-2xs border">
                <span>Store:</span>
                <span className="capitalize">{activeMerchant}</span>
                <button type="button" onClick={() => handleSelectMerchant('all')} className="text-slate-400 hover:text-red-500 font-black">×</button>
              </span>
            )}
            {activeBrand !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-bold text-slate-800 shadow-2xs border">
                <span>Brand:</span>
                <span className="capitalize">{activeBrand}</span>
                <button type="button" onClick={() => setActiveBrand('all')} className="text-slate-400 hover:text-red-500 font-black">×</button>
              </span>
            )}
            {activeMinDiscount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-bold text-slate-800 shadow-2xs border">
                <span>Min: {activeMinDiscount}% Off</span>
                <button type="button" onClick={() => setActiveMinDiscount(0)} className="text-slate-400 hover:text-red-500 font-black">×</button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                handleSelectMerchant('all');
                setActiveBrand('all');
                setActiveMinDiscount(0);
              }}
              className="ml-auto font-black text-brand underline text-[11px]"
            >
              Reset All
            </button>
          </div>
        )}

        {/* Discount Bands & Sorting Bar */}
        <V2DiscountBands
          activeMinDiscount={activeMinDiscount}
          onSelectDiscount={setActiveMinDiscount}
          dealCount={filteredDeals.length}
          activeSort={activeSort}
          onSelectSort={setActiveSort}
        />

        {/* Loading Spinner during Refresh */}
        {isRefreshing ? (
          <div className="my-16 flex flex-col items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-3 border-brand border-t-transparent" />
            <p className="mt-3 text-xs font-bold text-slate-600">Fetching verified live drops...</p>
          </div>
        ) : filteredDeals.length > 0 ? (
          /* High-Fidelity 6-Column Grid */
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredDeals.map((deal) => (
              <V2DealCard
                key={deal._id || deal.id}
                deal={deal}
                onImageUnavailable={handleImageUnavailable}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="my-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <span className="text-5xl mb-3">🔍</span>
            <h3 className="text-base font-extrabold text-slate-800">
              No deals match your current filter combination
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              We track new deals every few seconds. Try clearing the store or brand filter to see all active price drops.
            </p>
            <button
              type="button"
              onClick={() => {
                handleSelectMerchant('all');
                setActiveBrand('all');
                setActiveMinDiscount(0);
              }}
              className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-[#e05d00]"
            >
              Reset Filters &amp; View All
            </button>
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4 w-full" />

        {loadingMore && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 border border-slate-200 shadow-xs">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-xs font-bold text-slate-600">Loading more live drops...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
