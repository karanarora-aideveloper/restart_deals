'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCompare } from '@/lib/useCompare';
import { compareProductList } from '@/lib/specExtractor';
import { getAffiliateUrl, getMerchantInfo, formatInr } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import AddCompareProductModal from '@/components/AddCompareProductModal';
import CompareUrlInput from '@/components/CompareUrlInput';

export default function ProductCompareView({ initialProducts = [] }) {
  const {
    compareItems,
    activeComparisonType,
    activeComparisonTypeLabel,
    activeQueryKeywords,
    addToCompare,
    removeFromCompare,
    clearCompare,
  } = useCompare();
  const [highlightDiffs, setHighlightDiffs] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Merge initialProducts from URL props with user's local compareItems if available
  const activeProducts = useMemo(() => {
    if (compareItems.length > 0) return compareItems;
    return initialProducts;
  }, [compareItems, initialProducts]);

  const comparisonData = useMemo(() => {
    return compareProductList(activeProducts);
  }, [activeProducts]);

  const { items, sections, diffs, lowestPrice, highestDiscount, highestRating, bestValuePick } = comparisonData;

  const toggleSection = (secId) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      const pids = activeProducts.map((p) => p._id || p.productId || p.id).join(',');
      const shareUrl = `${window.location.origin}/compare?ids=${encodeURIComponent(pids)}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      }
    }
  };

  const handleBuyClick = (item) => {
    logEvent('click_compare_deal', {
      item_id: item.raw._id || item.raw.productId,
      item_name: item.raw.title,
    });
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center p-6">
        <div className="flex max-w-xl w-full flex-col items-center rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-brand">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>
          </div>
          <h2 className="mt-4 text-xl font-black text-gray-900">Compare Store Prices & Specs</h2>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-md">
            Paste any Amazon or Flipkart product link below to compare live prices, or pick products from our catalog to compare full technical specifications side-by-side.
          </p>

          {/* Universal Link Paste Box */}
          <div className="mt-6 w-full">
            <CompareUrlInput />
          </div>

          <div className="my-5 flex items-center gap-3 w-full">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-5 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5v14"/></svg>
            Choose Products from Catalog
          </button>
        </div>

        <AddCompareProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSelectProduct={addToCompare}
          currentProductIds={[]}
          lockedComparisonType={null}
          lockedComparisonTypeLabel=""
          lockedQueryKeywords=""
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Universal Paste Bar */}
      <div className="mb-4">
        <CompareUrlInput />
      </div>

      {/* Top Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
            Track Prices
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
              Side-by-Side Comparison
            </h1>
            {activeComparisonTypeLabel && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700 border border-indigo-200">
                {activeComparisonTypeLabel}
              </span>
            )}
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-black text-brand border border-orange-200">
              {items.length} of 4 Products
            </span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Highlight Differences Toggle */}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={highlightDiffs}
              onChange={(e) => setHighlightDiffs(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand accent-brand"
            />
            <span>Highlight Differences</span>
          </label>

          {/* Add Product Button (if < 4 items) */}
          {items.length < 4 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5v14"/></svg>
              + Add Product
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={handleShareLink}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>{copiedToast ? 'Copied Link!' : 'Share'}</span>
          </button>

          {/* Clear All */}
          <button
            onClick={clearCompare}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Comparison Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm scrollbar-none no-scrollbar">
        <table className="w-full border-collapse text-left">
          {/* 1. STICKY TOP PRODUCT HEADER */}
          <thead>
            <tr className="border-b-2 border-gray-200 bg-white divide-x divide-gray-100">
              <th className="w-48 min-w-48 bg-gray-50/80 p-4 text-xs font-black uppercase text-gray-500">
                Products & Pricing
              </th>
              {items.map((item, idx) => {
                const prod = item.raw;
                const specs = item.specs;
                const meta = specs._meta || {};
                const brand = specs.brand;
                const price = meta.currentPrice;
                const origPrice = meta.originalPrice;
                const discount = meta.discountPct;
                const isLowest = price > 0 && price === lowestPrice && items.length > 1;
                const url = meta.cleanUrl;
                const affiliateUrl = getAffiliateUrl(url);
                const merchant = getMerchantInfo(url);
                const id = String(prod._id || prod.productId || prod.id || idx);

                return (
                  <th key={id} className="min-w-64 max-w-xs p-4 align-top">
                    <div className="relative flex flex-col items-center text-center">
                      {/* Remove Button */}
                      <button
                        onClick={() => removeFromCompare(id)}
                        className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Remove product"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>

                      {/* Product Thumbnail */}
                      <div className="flex h-32 w-full items-center justify-center p-2">
                        {prod.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={prod.imageUrl} alt={prod.title} className="h-full max-h-28 w-auto object-contain" />
                        ) : (
                          <svg className="h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        )}
                      </div>

                      {/* Brand & Winner Badges */}
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-[11px] font-black uppercase text-indigo-600 tracking-wider">{brand}</span>
                        {isLowest && (
                          <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-800">
                            ★ Lowest Price
                          </span>
                        )}
                        {bestValuePick && String(bestValuePick.raw._id || bestValuePick.raw.productId) === id && items.length > 1 && (
                          <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-extrabold text-amber-900 border border-amber-300">
                            👑 Best Value Pick
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="line-clamp-2 mt-1 text-xs font-extrabold text-gray-900 leading-snug">
                        {prod.title}
                      </h3>

                      {/* Pricing Row */}
                      <div className="mt-2 flex items-baseline justify-center gap-2">
                        <span className="text-base font-black text-gray-900">{formatInr(price, prod.country)}</span>
                        {origPrice && origPrice > price && (
                          <span className="text-xs text-gray-400 line-through">{formatInr(origPrice, prod.country)}</span>
                        )}
                        {discount && discount > 0 ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600">
                            {discount}% OFF
                          </span>
                        ) : null}
                      </div>

                      {/* Rating & Merchant Pill */}
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <span className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 border border-amber-200">
                          ★ {meta.rating}
                        </span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                          {meta.merchant}
                        </span>
                      </div>

                      {/* Buy CTA */}
                      <a
                        href={affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        onClick={() => handleBuyClick(item)}
                        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black shadow-xs transition-all ${
                          merchant.badgeClass || 'bg-brand text-white hover:brightness-110'
                        }`}
                      >
                        <span>Buy on {meta.merchant}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
                      </a>
                    </div>
                  </th>
                );
              })}

              {/* Empty Slot Placeholder if < 4 */}
              {items.length < 4 && (
                <th className="min-w-64 max-w-xs p-4 align-middle bg-gray-50/50">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-brand hover:bg-orange-50/30 transition-all group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-brand group-hover:scale-110 transition-transform">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5v14"/></svg>
                    </div>
                    <span className="mt-3 text-xs font-black text-gray-900 group-hover:text-brand">
                      + Add Product
                    </span>
                    <span className="mt-0.5 text-[11px] text-gray-400">
                      Compare up to 4 devices
                    </span>
                  </button>
                </th>
              )}
            </tr>
          </thead>

          {/* 2. SPECIFICATION ACCORDION SECTIONS */}
          <tbody className="divide-y divide-gray-100">
            {/* AI Buying Verdict & Pros/Cons Section */}
            <tr className="bg-linear-to-r from-indigo-50/90 via-purple-50/70 to-orange-50/70 border-b border-indigo-100">
              <td
                colSpan={items.length + (items.length < 4 ? 2 : 1)}
                onClick={() => toggleSection('aiVerdict')}
                className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-wider text-indigo-950 hover:bg-indigo-100/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-indigo-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-white text-[10px]">🤖</span>
                    <span>ShoppersDeals AI Buying Verdict & Pros / Cons</span>
                    <span className="rounded-full bg-indigo-200/60 px-2 py-0.5 text-[9.5px] font-extrabold text-indigo-900 lowercase">
                      spec-backed
                    </span>
                  </span>
                  <svg
                    className={`h-4 w-4 text-indigo-700 transition-transform ${collapsedSections['aiVerdict'] ? '' : 'rotate-180'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </td>
            </tr>

            {!collapsedSections['aiVerdict'] && (
              <tr className="divide-x divide-gray-100 bg-white">
                <td className="w-48 min-w-48 bg-indigo-50/30 p-4 text-xs font-extrabold text-gray-700 align-top">
                  <div className="font-black text-indigo-900">AI Analysis & Recommendation</div>
                  <p className="mt-1 text-[11px] text-gray-500 font-normal leading-relaxed">
                    Independent technical specification strengths, points to consider & target buyer profile.
                  </p>
                </td>
                {items.map((item, idx) => {
                  const v = item.specs.aiVerdict || {};
                  const id = String(item.raw._id || item.raw.productId || idx);
                  return (
                    <td key={id} className="min-w-64 max-w-xs p-4 align-top">
                      <div className="flex flex-col gap-3">
                        {/* Value Score */}
                        <div className="flex items-center justify-between rounded-xl bg-indigo-50/80 px-3 py-1.5 border border-indigo-100">
                          <span className="text-[11px] font-bold text-indigo-900">AI Value Score</span>
                          <span className="text-xs font-black text-indigo-700">★ {v.score || 8.5} / 10</span>
                        </div>

                        {/* Pros */}
                        {v.pros && v.pros.length > 0 && (
                          <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Key Strengths</span>
                            <ul className="mt-1.5 space-y-1.5">
                              {v.pros.map((p, pIdx) => (
                                <li key={pIdx} className="flex items-start gap-1.5 text-[11px] font-medium text-gray-800 leading-snug">
                                  <span className="text-emerald-600 font-black">✓</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Cons */}
                        {v.cons && v.cons.length > 0 && (
                          <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-100">
                            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Points to Consider</span>
                            <ul className="mt-1.5 space-y-1.5">
                              {v.cons.map((c, cIdx) => (
                                <li key={cIdx} className="flex items-start gap-1.5 text-[11px] font-medium text-gray-800 leading-snug">
                                  <span className="text-amber-600 font-bold">•</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Verdict */}
                        {v.verdict && (
                          <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-200/80">
                            <span className="text-[10px] font-black uppercase text-gray-700 tracking-wider">🎯 Best For</span>
                            <p className="mt-1 text-[11px] text-gray-700 leading-relaxed font-normal">
                              {v.verdict}
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
                {items.length < 4 && <td className="bg-gray-50/30 p-4"></td>}
              </tr>
            )}
            {sections.map((section) => {
              const isCollapsed = collapsedSections[section.id];
              const allKeys = new Set();
              items.forEach((item) => {
                const secData = item.specs[section.id] || {};
                Object.keys(secData).forEach((k) => allKeys.add(k));
              });
              const keyList = Array.from(allKeys);

              if (keyList.length === 0) return null;

              return (
                <React.Fragment key={section.id}>
                  {/* Section Title Banner */}
                  <tr className="bg-gray-100/80">
                    <td
                      colSpan={items.length + (items.length < 4 ? 2 : 1)}
                      onClick={() => toggleSection(section.id)}
                      className="cursor-pointer px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gray-800 hover:bg-gray-200/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>{section.title}</span>
                        <svg
                          className={`h-4 w-4 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </td>
                  </tr>

                  {/* Section Spec Rows */}
                  {!isCollapsed &&
                    keyList.map((specKey, rowIdx) => {
                      const diffKey = `${section.id}_${specKey}`;
                      const isDiff = diffs[diffKey];
                      const shouldHighlight = highlightDiffs && isDiff;
                      const isDimmed = highlightDiffs && !isDiff;

                      return (
                        <tr
                          key={specKey}
                          className={`divide-x divide-gray-100 transition-colors ${
                            rowIdx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                          } ${shouldHighlight ? 'bg-indigo-50/40' : ''} ${isDimmed ? 'opacity-40' : ''}`}
                        >
                          {/* Spec Label Cell */}
                          <td className="w-48 min-w-48 bg-gray-50/60 p-3.5 text-xs font-extrabold text-gray-700">
                            <div>{specKey}</div>
                            {shouldHighlight && (
                              <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-700">
                                Differs
                              </span>
                            )}
                          </td>

                          {/* Product Value Cells */}
                          {items.map((item, idx) => {
                            const val = item.specs[section.id]?.[specKey] ?? '—';
                            const id = String(item.raw._id || idx);

                            return (
                              <td
                                key={id}
                                className={`min-w-64 max-w-xs p-3.5 text-xs font-semibold text-gray-800 leading-relaxed ${
                                  shouldHighlight ? 'font-bold text-indigo-950' : ''
                                }`}
                              >
                                {String(val)}
                              </td>
                            );
                          })}

                          {/* Empty Column spacer */}
                          {items.length < 4 && <td className="min-w-64 max-w-xs bg-gray-50/20 p-3.5" />}
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* 3. AMAZON ASSOCIATES COMPLIANCE DISCLAIMER */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>
              <p className="font-bold text-gray-700">Affiliate & Price Accuracy Disclosure</p>
              <p className="mt-0.5 leading-relaxed">
                Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.in, Flipkart, or respective merchant sites at the time of purchase will apply to the purchase of this product. As an affiliate partner, we may earn a commission from qualifying purchases.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <AddCompareProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectProduct={addToCompare}
        currentProductIds={items.map((i) => String(i.raw._id || i.raw.productId || i.raw.id))}
        lockedComparisonType={activeComparisonType}
        lockedComparisonTypeLabel={activeComparisonTypeLabel}
        lockedQueryKeywords={activeQueryKeywords}
      />
    </div>
  );
}
