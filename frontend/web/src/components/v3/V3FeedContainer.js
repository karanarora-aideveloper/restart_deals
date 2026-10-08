'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const STORE_GROUPS = [
  { id: 'all', label: 'All Stores' },
  { id: 'marketplaces', label: 'Marketplaces' },
  { id: 'd2c', label: 'D2C Brands' },
  { id: 'qcom', label: 'Quick Commerce' },
];

const STORES = [
  { id: 'all', label: 'All Stores', icon: '🏪', group: 'all' },
  // Major Marketplaces
  { id: 'amazon', label: 'Amazon', icon: '🛒', group: 'marketplaces' },
  { id: 'flipkart', label: 'Flipkart', icon: '🛍️', group: 'marketplaces' },
  { id: 'myntra', label: 'Myntra', icon: '👗', group: 'marketplaces' },
  { id: 'shopsy', label: 'Shopsy', icon: '🛍️', group: 'marketplaces' },
  { id: 'nykaa', label: 'Nykaa', icon: '💄', group: 'marketplaces' },
  { id: 'ajio', label: 'Ajio', icon: '🕶️', group: 'marketplaces' },
  { id: 'meesho', label: 'Meesho', icon: '🎁', group: 'marketplaces' },
  { id: 'croma', label: 'Croma', icon: '⚡', group: 'marketplaces' },
  // Top D2C Brands
  { id: 'plum', label: 'Plum Goodness', icon: '🌿', group: 'd2c' },
  { id: 'mamaearth', label: 'Mamaearth', icon: '🌱', group: 'd2c' },
  { id: 'thedermaco', label: 'The Derma Co', icon: '🔬', group: 'd2c' },
  { id: 'boat', label: 'boAt Lifestyle', icon: '🎧', group: 'd2c' },
  { id: 'mcaffeine', label: 'mCaffeine', icon: '☕', group: 'd2c' },
  { id: 'dotandkey', label: 'Dot & Key', icon: '✨', group: 'd2c' },
  { id: 'sugar', label: 'SUGAR', icon: '💄', group: 'd2c' },
  { id: 'minimalist', label: 'Minimalist', icon: '🧪', group: 'd2c' },
  { id: 'noise', label: 'Noise', icon: '⌚', group: 'd2c' },
  { id: 'boult', label: 'Boult Audio', icon: '🎵', group: 'd2c' },
  { id: 'snitch', label: 'Snitch', icon: '👔', group: 'd2c' },
  // Quick Commerce
  { id: 'blinkit', label: 'Blinkit', icon: '⚡', group: 'qcom' },
  { id: 'instamart', label: 'Instamart', icon: '🍊', group: 'qcom' },
  { id: 'zepto', label: 'Zepto', icon: '⚡', group: 'qcom' },
];

const SOURCE_ENGINES = [
  { id: 'all', label: '⚡ All Deals', badge: 'All' },
  { id: 'engine1', label: '📡 Engine 1 (Telegram Radar)', badge: 'Engine 1' },
  { id: 'engine2', label: '🤖 Engine 2 (Store Watcher)', badge: 'Engine 2' },
];

export default function V3FeedContainer({ initialDeals = [], initialHasMore = false, category = 'all', merchant = 'all', country = 'in' }) {
  const [deals, setDeals] = useState(() => sortDealsByDealTime(initialDeals));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState(category);
  const [activeStore, setActiveStore] = useState(merchant || 'all');
  const [selectedStoreGroup, setSelectedStoreGroup] = useState(() => {
    if (merchant && merchant !== 'all') {
      const found = STORES.find((s) => s.id === merchant);
      return found?.group || 'all';
    }
    return 'all';
  });
  const [activeEngine, setActiveEngine] = useState('all');
  const [minDiscount, setMinDiscount] = useState(0);
  const [savedDeals, setSavedDeals] = useState([]);

  useEffect(() => {
    setSavedDeals(getSavedDeals());
  }, []);

  useEffect(() => {
    setDeals(sortDealsByDealTime(initialDeals));
    setHasMore(initialHasMore);
  }, [initialDeals, initialHasMore]);

  const prevMerchantRef = useRef(merchant);
  useEffect(() => {
    if (prevMerchantRef.current !== merchant) {
      prevMerchantRef.current = merchant;
      setActiveStore(merchant || 'all');
      const found = STORES.find((s) => s.id === merchant);
      if (found && found.group !== 'all') {
        setSelectedStoreGroup(found.group);
      }
    }
  }, [merchant]);

  const filteredStores = STORES.filter((s) => {
    if (selectedStoreGroup === 'all') return true;
    return s.id === 'all' || s.group === selectedStoreGroup;
  });

  // Fetch deals with filters
  const fetchFilteredDeals = useCallback(async (cat, store, minDisc, engine = 'all', targetPage = 1, append = false) => {
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
      if (engine && engine !== 'all') params.set('sourceEngine', engine);

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

  const updateUrlParams = (cat, store) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (cat && cat !== 'all') url.searchParams.set('category', cat);
    else url.searchParams.delete('category');
    if (store && store !== 'all') url.searchParams.set('merchant', store);
    else url.searchParams.delete('merchant');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  const handleEngineChange = (engineId) => {
    setActiveEngine(engineId);
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, engineId, 1, false);
  };

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    updateUrlParams(catId, activeStore);
    fetchFilteredDeals(catId, activeStore, minDiscount, activeEngine, 1, false);
  };

  const handleStoreChange = (storeId) => {
    const nextStore = (activeStore === storeId && storeId !== 'all') ? 'all' : storeId;
    setActiveStore(nextStore);
    updateUrlParams(activeCategory, nextStore);
    fetchFilteredDeals(activeCategory, nextStore, minDiscount, activeEngine, 1, false);
  };

  const handleDiscountChange = (disc) => {
    setMinDiscount(disc);
    fetchFilteredDeals(activeCategory, activeStore, disc, activeEngine, 1, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchFilteredDeals(activeCategory, activeStore, minDiscount, activeEngine, page + 1, true);
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
        {/* Row 0: Discovery Engine Selector */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Deal Source:</span>
          {SOURCE_ENGINES.map((eng) => (
            <button
              key={eng.id}
              onClick={() => handleEngineChange(eng.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeEngine === eng.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <span>{eng.label}</span>
            </button>
          ))}
        </div>

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

        {/* Row 3: Store Selector with Group Filter & Pills */}
        <div className="flex flex-col gap-1.5 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <span className="text-xs font-bold text-slate-400 shrink-0 mr-1">Store:</span>
              {STORE_GROUPS.map((grp) => (
                <button
                  key={grp.id}
                  onClick={() => setSelectedStoreGroup(grp.id)}
                  className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-all whitespace-nowrap ${
                    selectedStoreGroup === grp.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>
            {activeStore !== 'all' && (
              <button
                onClick={() => handleStoreChange('all')}
                className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
              >
                Clear Store ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
            {filteredStores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleStoreChange(store.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  activeStore === store.id
                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/50 font-black'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/40'
                }`}
              >
                {store.icon && <span className="text-xs">{store.icon}</span>}
                <span>{store.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deals Count Banner */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Showing <strong className="text-slate-900 font-bold">{deals.length}</strong> verified price-drop items</span>
        {(activeCategory !== 'all' || activeStore !== 'all' || minDiscount > 0 || activeEngine !== 'all') && (
          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveStore('all');
              setSelectedStoreGroup('all');
              setMinDiscount(0);
              setActiveEngine('all');
              updateUrlParams('all', 'all');
              fetchFilteredDeals('all', 'all', 0, 'all', 1, false);
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
