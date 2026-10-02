'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { extractBrandFromTitle, getDetailedProductType } from '@/lib/specExtractor';

const POPULAR_NICHES = [
  { id: 'all', label: 'All Catalog' },
  { id: 'mobile-phone', label: '📱 Mobiles' },
  { id: 'smart-tv', label: '📺 Smart TVs' },
  { id: 'water-purifier', label: '💧 Water Purifiers' },
  { id: 'refrigerator', label: '❄️ Refrigerators' },
  { id: 'washing-machine', label: '🧺 Washing Machines' },
  { id: 'air-conditioner', label: '❄️ Air Conditioners' },
  { id: 'laptop', label: '💻 Laptops' },
  { id: 'audio-tws', label: '🎧 TWS Earbuds' },
];

export default function AddCompareProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  currentProductIds = [],
  lockedComparisonType = null,
  lockedComparisonTypeLabel = '',
  lockedQueryKeywords = '',
}) {
  const [search, setSearch] = useState('');
  const [activeNiche, setActiveNiche] = useState(lockedComparisonType || 'all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const targetNiche = lockedComparisonType || activeNiche;
      fetchCandidates(search, targetNiche);
    }
  }, [isOpen, lockedComparisonType, activeNiche]);

  const fetchCandidates = async (query = '', niche = 'all') => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/products?limit=50&imageStatus=has_image`;
      
      const effectiveNiche = lockedComparisonType || niche;

      // Smart keyword enrichment for specific niches
      let effectiveQuery = query.trim();
      if (!effectiveQuery && effectiveNiche && effectiveNiche !== 'all') {
        if (effectiveNiche === 'water-purifier') effectiveQuery = 'purifier';
        else if (effectiveNiche === 'refrigerator') effectiveQuery = 'refrigerator';
        else if (effectiveNiche === 'washing-machine') effectiveQuery = 'washing machine';
        else if (effectiveNiche === 'air-conditioner') effectiveQuery = 'ac';
        else if (effectiveNiche === 'smart-tv') effectiveQuery = 'tv';
        else if (effectiveNiche === 'mobile-phone') effectiveQuery = 'phone';
        else if (effectiveNiche === 'laptop') effectiveQuery = 'laptop';
        else if (effectiveNiche === 'audio-tws') effectiveQuery = 'earbuds';
        else if (lockedQueryKeywords) effectiveQuery = lockedQueryKeywords;
      }

      if (effectiveQuery) {
        url += `&q=${encodeURIComponent(effectiveQuery)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      let rawList = [];
      if (data.success && Array.isArray(data.data)) {
        rawList = data.data;
      } else if (data.success && Array.isArray(data.products)) {
        rawList = data.products;
      } else if (Array.isArray(data)) {
        rawList = data;
      }

      // STRICT NICHE FILTERING: If a niche is locked or selected, guarantee only matching products pass
      if (effectiveNiche && effectiveNiche !== 'all') {
        const filtered = rawList.filter((prod) => {
          const type = getDetailedProductType(prod);
          return type.slug === effectiveNiche;
        });
        setResults(filtered.length > 0 ? filtered : rawList);
      } else {
        setResults(rawList);
      }
    } catch (err) {
      console.error('Failed to fetch candidate compare products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCandidates(search, lockedComparisonType || activeNiche);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Add Product to Compare</h3>
            <p className="text-xs text-gray-500">
              {lockedComparisonType
                ? `Showing ${lockedComparisonTypeLabel} only for accurate side-by-side comparison`
                : 'Select items from the same category to compare specifications'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Locked Niche Indicator Banner */}
        {lockedComparisonType ? (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2.5 text-xs font-bold text-brand border border-orange-200/70">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Comparing Exact Niche: <strong className="text-gray-900">{lockedComparisonTypeLabel}</strong></span>
          </div>
        ) : null}

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="p-4 pb-2">
          <div className="relative flex items-center">
            <svg className="absolute left-3.5 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lockedComparisonType ? `Search within ${lockedComparisonTypeLabel}...` : 'Search Kent RO, LG Refrigerator, Sony OLED, iPhone...'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchCandidates('', lockedComparisonType || activeNiche); }}
                className="absolute right-3 text-gray-400 hover:text-gray-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              </button>
            )}
          </div>
        </form>

        {/* Popular Niche Pills (only shown if not locked) */}
        {!lockedComparisonType && (
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
            {POPULAR_NICHES.map((c) => {
              const isSelected = activeNiche === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveNiche(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Product Results List */}
        <div className="flex-1 overflow-y-auto p-4 pt-1 divide-y divide-gray-50 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="h-8 w-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="mt-3 text-xs font-semibold text-gray-500">Searching {lockedComparisonTypeLabel || 'products'}...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-10 w-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="8" height="18" x="3" y="3" rx="1"/><rect width="8" height="18" x="13" y="3" rx="1"/></svg>
              <p className="mt-2 text-sm font-bold text-gray-700">No matching products found</p>
              <p className="text-xs text-gray-400">Try searching by model number or brand name</p>
            </div>
          ) : (
            results.map((prod) => {
              const id = String(prod._id || prod.productId);
              const isAlreadyAdded = currentProductIds.includes(id);
              const brand = extractBrandFromTitle(prod.title);
              const price = prod.price || prod.dealPrice;
              const priceStr = price ? `₹${Number(price).toLocaleString('en-IN')}` : 'Check Price';
              const pType = getDetailedProductType(prod);

              return (
                <div
                  key={id}
                  className={`flex items-center gap-3.5 py-3 transition-colors ${
                    isAlreadyAdded ? 'opacity-50' : 'hover:bg-gray-50/80 rounded-xl px-2'
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white p-1">
                    {prod.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={prod.imageUrl} alt={prod.title} className="h-full w-full object-contain" />
                    ) : (
                      <svg className="h-6 w-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-indigo-600">{brand}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 uppercase">
                        {prod.merchant || 'Amazon'}
                      </span>
                      <span className="text-[9.5px] font-bold text-gray-400">
                        {pType.label}
                      </span>
                    </div>
                    <h4 className="line-clamp-1 text-xs font-bold text-gray-900 mt-0.5">{prod.title}</h4>
                    <p className="text-xs font-extrabold text-gray-900 mt-1">{priceStr}</p>
                  </div>

                  <div>
                    {isAlreadyAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectProduct(prod);
                          onClose();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 active:scale-95 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5v14"/></svg>
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
