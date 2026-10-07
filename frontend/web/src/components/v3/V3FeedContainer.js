'use client';

import React, { useState, useEffect, useCallback } from 'react';
import V3DealCard from './V3DealCard';
import { getSavedDeals } from '@/lib/savedDeals';
import { API_BASE_URL } from '@/lib/config';
import { isUsableImageUrl } from '@/lib/affiliate';

function sortDealsByDealTime(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.postedAt || a.updatedAt || a.lastVerifiedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.postedAt || b.updatedAt || b.lastVerifiedAt || 0).getTime();
    return timeB - timeA;
  });
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'mobiles', label: 'Mobiles' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'appliances', label: 'Appliances' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'home', label: 'Home & Kitchen' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'grocery', label: 'Grocery' },
];

const DISCOUNT_BANDS = [
  { id: 0, label: 'All Drops' },
  { id: 10, label: '10%+ Drop' },
  { id: 20, label: '20%+ Drop' },
  { id: 30, label: '30%+ Drop' },
  { id: 50, label: '50%+ Loot' },
];

const STORES = [
  { id: 'all', label: 'All Stores' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'myntra', label: 'Myntra' },
  { id: 'nykaa', label: 'Nykaa' },
  { id: 'ajio', label: 'Ajio' },
  { id: 'meesho', label: 'Meesho' },
  { id: 'croma', label: 'Croma' },
];

export default function V3FeedContainer({ initialDeals = [], initialHasMore = false, category = 'all', country = 'in' }) {
  const [deals, setDeals] = useState(() => sortDealsByDealTime(initialDeals));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState(category);
  const [activeStore, setActiveStore] = useState('all');
  const [minDiscount, setMinDiscount] = useState(0);
  const [savedDeals, setSavedDeals] = useState([]);

  useEffect(() => {
    setSavedDeals(getSavedDeals());
  }, []);

  useEffect(() => {
    setDeals(sortDealsByDealTime(initialDeals));
    setHasMore(initialHasMore);
  }, [initialDeals, initialHasMore]);

  // Fetch deals with filters
  const fetchFilteredDeals = useCallback(async (cat, store, minDisc, targetPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        country: 'in', // strictly India locale
        page: targetPage.toString(),
        limit: '24',
        sort: 'newest',
      });

      if (cat && cat !== 'all') params.set('category', cat);
      if (store && store !== 'all') params.set('merchant', store);
      if (minDisc && minDisc > 0) params.set('minDiscount', minDisc.toString());

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
      const newItems = sortDealsByDealTime(rawList.filter((d) => isUsableImageUrl(d.imageUrl)));

      if (append) {
        setDeals((prev) => sortDealsByDealTime([...prev, ...newItems]));
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
  }, []);

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    fetchFilteredDeals(catId, activeStore, minDiscount, 1, false);
  };

  const handleStoreChange = (storeId) => {
    setActiveStore(storeId);
    fetchFilteredDeals(activeCategory, storeId, minDiscount, 1, false);
  };

  const handleDiscountChange = (disc) => {
    setMinDiscount(disc);
    fetchFilteredDeals(activeCategory, activeStore, disc, 1, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, page + 1, true);
  };

  return (
    <section id="deals" className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
      {/* Buyhatke Exact Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            <span>⚡ Unmissable Deals</span>
          </div>
          <h2 className="mt-1.5 text-lg sm:text-xl font-black tracking-tight text-[#1E1B4B]">
            Best Discounts &amp; Verified Steals
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Hot deals under the scanner — See what’s trending, most-searched, and whether it’s really worth the hype.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Powered by</span>
          <span className="rounded-lg bg-indigo-100/70 px-2 py-0.5 text-xs font-black text-indigo-700">
            Smart Deal Scanner
          </span>
        </div>
      </div>

      {/* Filter Matrix (Buyhatke Layout) */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Row 1: Discount % Bands */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Price Drop:</span>
          {DISCOUNT_BANDS.map((band) => (
            <button
              key={band.id}
              onClick={() => handleDiscountChange(band.id)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all whitespace-nowrap ${
                minDiscount === band.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>

        {/* Row 2: Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-[#5855E5] text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Row 3: Store Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Store:</span>
          {STORES.map((store) => (
            <button
              key={store.id}
              onClick={() => handleStoreChange(store.id)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all whitespace-nowrap ${
                activeStore === store.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-500'
              }`}
            >
              {store.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deals Count Banner */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Showing <strong className="text-slate-900 font-bold">{deals.length}</strong> verified price-drop items</span>
        {(activeCategory !== 'all' || activeStore !== 'all' || minDiscount > 0) && (
          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveStore('all');
              setMinDiscount(0);
              fetchFilteredDeals('all', 'all', 0, 1, false);
            }}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            Clear all filters ✕
          </button>
        )}
      </div>

      {/* Deal Grid */}
      {loading ? (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
              <div className="h-4 w-16 rounded-md bg-slate-200 mb-2" />
              <div className="h-36 w-full rounded-lg bg-slate-100 mb-2" />
              <div className="h-3 w-3/4 rounded-md bg-slate-200 mb-1.5" />
              <div className="h-3 w-1/2 rounded-md bg-slate-200 mb-3" />
              <div className="h-7 w-full rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      ) : deals.length > 0 ? (
        <div className="mt-4 sm:mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3">
          {deals.map((deal) => (
            <V3DealCard
              key={deal._id || deal.id}
              deal={deal}
              savedDeals={savedDeals}
              onSavedChange={setSavedDeals}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs">
          <span className="text-4xl">🔍</span>
          <h3 className="mt-3 text-lg font-bold text-slate-900">No matching deals found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {activeCategory !== 'all' || activeStore !== 'all' || minDiscount > 0
              ? 'No deals match your selected filters. Try clearing them to see all live deals.'
              : 'New deals are being scanned and verified right now. Click below to refresh the feed.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setActiveStore('all');
                setMinDiscount(0);
                fetchFilteredDeals('all', 'all', 0, 1, false);
              }}
              className="rounded-xl bg-[#5855E5] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#4743DE] transition-colors"
            >
              Reset Filters &amp; View All Deals
            </button>
            <button
              type="button"
              onClick={() => fetchFilteredDeals(activeCategory, activeStore, minDiscount, 1, false)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              ↻ Refresh Feed
            </button>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#5855E5] px-8 py-3.5 text-sm font-black text-white shadow-md transition-all hover:bg-[#4743DE] disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Loading more deals...</span>
              </>
            ) : (
              <span>Load More Unmissable Deals ↓</span>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
