'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import DealCard from './DealCard';
import ProductCard from './ProductCard';
import { API_BASE_URL } from '@/lib/config';
import { isUsableImageUrl } from '@/lib/affiliate';
import { searchAlgolia, hitToDeal, hitToProduct, DEALS_INDEX, PRODUCTS_INDEX } from '@/lib/algolia';
import { aggregateSeriesFeed } from '@/lib/seriesAggregation';
import { useAuth } from '@/components/AuthProvider';
import { getSavedDeals } from '@/lib/savedDeals';
import { SAVED_CHANGED_EVENT } from '@/lib/useSavedCount';

function dedupeKey(item) {
  return item._id || item.id || item.productId;
}

/**
 * Client-side live feed: hydrates from the server-rendered `initialItems` (so crawlers and
 * first paint get real content), then polls the same endpoint every 4s to bump updated items
 * to the top and prepend new ones — matching the native app's live-feed behavior — plus
 * infinite scroll for pagination.
 */
export default function DealsFeed({ type, initialItems, initialHasMore, emptyTitle, emptySub }) {
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const subcategory = searchParams.get('subcategory') || 'all';
  const merchant = searchParams.get('merchant') || 'all';
  const country = (searchParams.get('country') || 'in').toLowerCase();

  const [items, setItems] = useState(initialItems || []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore ?? (initialItems || []).length >= 40);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedDeals, setSavedDeals] = useState([]);
  const sentinelRef = useRef(null);

  const isDealsType = type === 'deals' || type === 'hot';
  const endpoint = isDealsType ? '/api/deals' : '/api/products';

  // Re-hydrate items whenever filters change (server already re-rendered `initialItems` for
  // the new searchParams on navigation, this just keeps local state in sync).
  useEffect(() => {
    setItems(aggregateSeriesFeed(initialItems || []));
    setPage(1);
    setHasMore(initialHasMore ?? (initialItems || []).length >= 40);
  }, [initialItems, initialHasMore]);

  // A deal/product with no image, or one whose image fails to actually load, is dropped
  // entirely rather than shown without a photo — matching the native app's behavior.
  const handleImageUnavailable = useCallback((id) => {
    setItems((prev) => prev.filter((i) => dedupeKey(i) !== id));
  }, []);

  useEffect(() => {
    const authUser = user && token ? { ...user, token } : null;
    getSavedDeals(authUser).then(setSavedDeals);
  }, [user, token]);

  useEffect(() => {
    const refresh = () => {
      const authUser = user && token ? { ...user, token } : null;
      getSavedDeals(authUser).then(setSavedDeals);
    };
    window.addEventListener(SAVED_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, refresh);
  }, [user, token]);

  const isSearching = q.trim().length > 0;

  const fetchSearchPage = useCallback(async (pageNum, { append = false } = {}) => {
    // When searching by keyword, always query the permanent PRODUCTS catalog so shoppers discover
    // products with price history, cross-store comparison, and drop alerts instead of ephemeral deals
    const indexName = PRODUCTS_INDEX;
    const facetFilters = [];
    if (category && category !== 'all') facetFilters.push(`category:${category}`);
    if (subcategory && subcategory !== 'all') facetFilters.push(`subcategory:${subcategory}`);
    if (merchant && merchant !== 'all') facetFilters.push(`merchant:${merchant}`);
    const res = await searchAlgolia({
      indexName,
      query: q.trim(),
      page: pageNum - 1,
      hitsPerPage: 40,
      facetFilters: facetFilters.length > 0 ? facetFilters : undefined,
    });
    let list = res.hits.map(hitToProduct);
    if (category && category !== 'all') {
      list = list.filter((item) => !item.category || item.category === category || item.category === 'all');
    }
    if (subcategory && subcategory !== 'all') {
      list = list.filter((item) => item.subcategory === subcategory);
    }
    setHasMore(pageNum < res.nbPages);
    list = aggregateSeriesFeed(list.filter((item) => isUsableImageUrl(item.imageUrl)));
    if (append) {
      setItems((prev) => aggregateSeriesFeed([...prev, ...list]));
    }
    return list;
  }, [q, category, subcategory, merchant]);

  const fetchListingPage = useCallback(async (pageNum, { append = false } = {}) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: '40',
      q,
      category,
      subcategory,
      merchant,
      country,
      sort: isDealsType ? 'newest' : 'recently_checked',
    });
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}?${params}`);
      const json = await res.json();
      let list = json.data || json.deals || [];
      if (type === 'hot') {
        list = list.filter((d) => d.discountPercentage && d.discountPercentage >= 40);
      }
      // hasMore reflects what the API actually had for this page — checked before the image
      // filter below so a page that happens to be mostly imageless doesn't look like "no more
      // results" and cut pagination short.
      setHasMore(list.length > 0);
      list = aggregateSeriesFeed(list.filter((item) => isUsableImageUrl(item.imageUrl)));
      if (append) {
        setItems((prev) => aggregateSeriesFeed([...prev, ...list]));
      }
      return list;
    } catch (err) {
      // Gracefully handle local dev when API server is not running
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[DealsFeed] API server at ${API_BASE_URL} is unreachable (${err.message}). Showing cached/SSR items.`);
      }
      return [];
    }
  }, [q, category, subcategory, merchant, country, isDealsType, endpoint, type]);

  const fetchPage = isSearching ? fetchSearchPage : fetchListingPage;

  // Live polling (page 1 only) — bumps updated items to the top and prepends new ones.
  // Skipped while actively searching. Backs off if API is unreachable.
  useEffect(() => {
    if (isSearching) return;
    let pollInterval = 4000;
    let failCount = 0;
    let timerId = null;

    const poll = async () => {
      const list = await fetchListingPage(1);
      if (list && list.length > 0) {
        failCount = 0;
        pollInterval = 4000;
        setItems((prev) => {
          const incomingIds = new Set(list.map(dedupeKey));
          const remaining = prev.filter((i) => !incomingIds.has(dedupeKey(i)));
          return [...list, ...remaining];
        });
      } else {
        failCount++;
        // If API fails 2+ times in a row, back off to 15s interval to save resources
        if (failCount >= 2) {
          pollInterval = 15000;
        }
      }
      timerId = setTimeout(poll, pollInterval);
    };

    timerId = setTimeout(poll, pollInterval);
    return () => clearTimeout(timerId);
  }, [fetchListingPage, isSearching]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchPage(nextPage, { append: true });
    setPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, fetchPage]);

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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
        <h2 className="mb-2 text-lg font-extrabold text-[#1a1a1a]">{emptyTitle}</h2>
        <p className="max-w-sm text-[13px] leading-5 text-[#999]">{emptySub}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 p-3 sm:gap-4 md:grid-cols-3 md:gap-5 md:p-0 md:pt-6 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) =>
          isSearching || !isDealsType ? (
            <ProductCard key={dedupeKey(item)} product={item} onImageUnavailable={handleImageUnavailable} />
          ) : (
            <DealCard
              key={dedupeKey(item)}
              deal={item}
              savedDeals={savedDeals}
              onSavedChange={setSavedDeals}
              onImageUnavailable={handleImageUnavailable}
            />
          )
        )}
      </div>
      <div ref={sentinelRef} className="h-px w-full" />
      {loadingMore && (
        <div className="flex items-center justify-center py-5">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-label="Loading more" />
        </div>
      )}
    </>
  );
}
