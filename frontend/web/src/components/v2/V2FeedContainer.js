'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import V2DealCard from './V2DealCard';
import V2DiscountBands from './V2DiscountBands';
import V2StoreRail from './V2StoreRail';
import { API_BASE_URL } from '@/lib/config';

export default function V2FeedContainer({ initialDeals = [], initialHasMore = true, activeCategory = 'all' }) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeMerchant, setActiveMerchant] = useState('all');
  const [activeMinDiscount, setActiveMinDiscount] = useState(0);
  const [activeSort, setActiveSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Sync initial deals if parent re-renders
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  // Client-side filtering & sorting for instant responsiveness
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Filter by merchant
    if (activeMerchant !== 'all') {
      result = result.filter((d) => {
        const m = (d.merchant || '').toLowerCase();
        return m.includes(activeMerchant.toLowerCase());
      });
    }

    // Filter by min discount
    if (activeMinDiscount > 0) {
      result = result.filter((d) => {
        const pct = d.discountPercentage ||
          (d.originalPrice && d.dealPrice ? Math.round(((d.originalPrice - d.dealPrice) / d.originalPrice) * 100) : 0);
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
      result.sort((a, b) => (a.dealPrice || 0) - (b.dealPrice || 0));
    } else if (activeSort === 'price_desc') {
      result.sort((a, b) => (b.dealPrice || 0) - (a.dealPrice || 0));
    } else {
      // Default: newest
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return result;
  }, [deals, activeMerchant, activeMinDiscount, activeSort]);

  // Infinite Scroll loading
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', '40');
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (activeMerchant !== 'all') params.set('merchant', activeMerchant);

      const res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
      const data = await res.json();
      const newItems = data.deals || data.data || [];
      if (newItems.length > 0) {
        setDeals((prev) => {
          const existingIds = new Set(prev.map((i) => i._id || i.id));
          const unique = newItems.filter((i) => !existingIds.has(i._id || i.id));
          return [...prev, ...unique];
        });
        setPage(nextPage);
        setHasMore(newItems.length >= 40);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[V2Feed Load More Error]', err);
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

  // Live polling every 6s for fresh price drops
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '20');
        if (activeCategory !== 'all') params.set('category', activeCategory);
        const res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
        const data = await res.json();
        const incoming = data.deals || data.data || [];
        if (incoming.length > 0) {
          setDeals((prev) => {
            const incomingIds = new Set(incoming.map((i) => i._id || i.id));
            const remaining = prev.filter((i) => !incomingIds.has(i._id || i.id));
            return [...incoming, ...remaining];
          });
        }
      } catch (e) {
        // silent fail for polling
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [activeCategory]);

  return (
    <div className="w-full">
      {/* Store Filter Rail */}
      <V2StoreRail
        activeMerchant={activeMerchant}
        onSelectMerchant={setActiveMerchant}
      />

      {/* Main Content Area */}
      <div className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* Discount Bands & Sorting Bar */}
        <V2DiscountBands
          activeMinDiscount={activeMinDiscount}
          onSelectDiscount={setActiveMinDiscount}
          dealCount={filteredDeals.length}
          activeSort={activeSort}
          onSelectSort={setActiveSort}
        />

        {/* Product Grid (6 columns on 2xl desktop) */}
        {filteredDeals.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredDeals.map((deal) => (
              <V2DealCard key={deal._id || deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="my-16 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-3">🔍</span>
            <h3 className="text-base font-bold text-slate-800">No deals match the selected criteria</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              Try choosing &quot;All Stores&quot; or lowering the minimum discount percentage.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveMerchant('all');
                setActiveMinDiscount(0);
              }}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              Reset Filters
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
