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
  { id: 'fashion', label: 'Fashion' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'home', label: 'Home' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'fitness', label: 'Fitness' },
];

const DISCOUNT_BANDS = [
  { id: 0, label: 'All Discounts' },
  { id: 40, label: '40%+ Off' },
  { id: 50, label: '50%+ Off' },
  { id: 60, label: '60%+ Off' },
  { id: 70, label: '70%+ Off' },
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

      const res = await fetch(`${API_BASE_URL}/api/deals?${params.toString()}`);
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
    <section id="deals" className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
      {/* Buyhatke Exact Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 px-3 py-1 text-xs font-bold text-indigo-700">
            <span>⚡ Unmissable Deals</span>
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-[#1E1B4B]">
            Best Discounts &amp; Verified Steals
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Hot deals under the scanner — See what’s trending, most-searched, and whether it’s really worth the hype.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Powered by</span>
          <span className="rounded-lg bg-indigo-100/70 px-2.5 py-1 text-xs font-black text-indigo-700">
            Smart Deal Scanner
          </span>
        </div>
      </div>

      {/* Filter Matrix (Buyhatke Layout) */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Row 1: Discount % Bands */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Discount:</span>
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
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-96 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-5 w-20 rounded-md bg-slate-200 mb-3" />
              <div className="h-44 w-full rounded-xl bg-slate-100 mb-3" />
              <div className="h-4 w-3/4 rounded-md bg-slate-200 mb-2" />
              <div className="h-4 w-1/2 rounded-md bg-slate-200 mb-4" />
              <div className="h-8 w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      ) : deals.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <span className="text-4xl">🔍</span>
          <h3 className="mt-3 text-lg font-bold text-slate-900">No matching deals found</h3>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your category, store, or discount filters above.
          </p>
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
