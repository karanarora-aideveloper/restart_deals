'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatInr, getAffiliateUrl } from '@/lib/affiliate';
import { API_BASE_URL } from '@/lib/config';

export default function StoreComparison({ product }) {
  const [stores, setStores] = useState([]);
  const [similarMatches, setSimilarMatches] = useState([]);
  const [hasExactMatch, setHasExactMatch] = useState(false);
  const [bestSavings, setBestSavings] = useState(0);
  const [savingsMessage, setSavingsMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCrossStoreData() {
      if (!product) return;
      setIsLoading(true);
      try {
        const prodId = product._id || product.productId;
        const countryParam = product.country ? `?country=${encodeURIComponent(product.country)}` : '';
        const res = await fetch(`${API_BASE_URL}/api/products/${prodId}/cross-store-compare${countryParam}`);
        const data = await res.json();

        if (data.success) {
          if (Array.isArray(data.stores)) {
            // Keep primary store, and secondary stores with verified real price & zero variant mismatch
            const verifiedStores = data.stores.filter(
              s => s.isPrimary || (s.hasRealPrice && s.price && !s.variantMismatch)
            );
            setStores(verifiedStores);
          }
          if (Array.isArray(data.similarMatches)) {
            setSimilarMatches(data.similarMatches);
          }
          setHasExactMatch(Boolean(data.hasExactMatch));
          setBestSavings(Number(data.bestSavings) || 0);
          setSavingsMessage(data.savingsMessage || null);
        }
      } catch (e) {
        console.error('[Cross-Store Load Error]', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadCrossStoreData();
  }, [product]);

  // Check if there are other verified stores to compare with
  const otherVerifiedStores = stores.filter(s => !s.isPrimary && s.hasRealPrice && s.price);
  const hasCrossStoreComparison = otherVerifiedStores.length > 0;

  // Don't render anything if loading or if no other stores and no similar items
  if (isLoading || (!hasCrossStoreComparison && similarMatches.length === 0)) {
    return null;
  }

  // Find if another store is cheaper than primary
  const cheaperStore = otherVerifiedStores.find(s => s.isCheaper && s.savingsAmount > 0);

  return (
    <div className="mt-8 space-y-6">
      {/* 1. Cross-Store Comparison Table */}
      {hasCrossStoreComparison && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-gray-900">Compare Live Store Prices</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  ⚡ 100% Exact Match
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Verified identical model & specifications across Indian stores</p>
            </div>
          </div>

          {/* Savings Highlight Alert Banner */}
          {cheaperStore && bestSavings > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 border border-emerald-200 p-3.5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="text-xs font-black text-emerald-900">
                    Better Price Available on {cheaperStore.name}!
                  </p>
                  <p className="text-[11px] font-medium text-emerald-700">
                    {savingsMessage || `Save ${formatInr(bestSavings, product?.country)} by buying on ${cheaperStore.name} right now.`}
                  </p>
                </div>
              </div>
              <a
                href={getAffiliateUrl(cheaperStore.url, product?.country)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition hover:bg-emerald-700"
              >
                Claim Deal →
              </a>
            </div>
          )}

          {/* Store Rows */}
          <div className="space-y-3">
            {stores.map((s) => {
              const isSavingsWinner = !s.isPrimary && s.isCheaper;

              return (
                <div
                  key={s.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-all ${
                    isSavingsWinner
                      ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-400/20'
                      : s.isPrimary
                        ? 'border-gray-200 bg-gray-50/70'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Left: Merchant Info & Variant Badge */}
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-xs border border-gray-200">
                      {s.logo}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-gray-900">{s.name}</span>
                        {s.isPrimary && (
                          <span className="rounded-md bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                            Current Store
                          </span>
                        )}
                        {!s.isPrimary && (
                          <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Exact Match
                          </span>
                        )}
                        {isSavingsWinner && (
                          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-2xs">
                            Best Price
                          </span>
                        )}
                      </div>

                      {/* Display exact spec / variant */}
                      {s.matchedVariant && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-gray-600">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span>{s.matchedVariant}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Price & Buy CTA Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-base font-black text-gray-900">
                        {formatInr(s.price, product?.country)}
                      </div>
                      {s.statusBadge && (
                        <div
                          className={`text-[11px] font-bold ${
                            isSavingsWinner
                              ? 'text-emerald-700'
                              : s.isPrimary
                                ? 'text-gray-500'
                                : 'text-gray-500'
                          }`}
                        >
                          {s.statusBadge}
                        </div>
                      )}
                    </div>

                    <a
                      href={getAffiliateUrl(s.url, product?.country)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-black shadow-xs transition-all ${
                        isSavingsWinner
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                          : s.isPrimary
                            ? 'bg-gray-900 text-white hover:bg-black'
                            : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {s.buttonText || (isSavingsWinner ? `Buy for ${formatInr(s.price, product?.country)}` : 'View Store')}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Similar Models & Specification Alternatives */}
      {similarMatches.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-gray-900">🔍 Similar Models & Specification Variants</h4>
              <p className="text-xs text-gray-500">Other storage, processor, or capacity variants across stores</p>
            </div>
            <span className="text-[11px] text-gray-500 font-semibold">Matched by AI</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {similarMatches.map((sim) => (
              <Link
                key={sim._id || sim.productId}
                href={`/product/${sim._id || sim.productId}`}
                className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 transition hover:border-brand/40 hover:bg-orange-50/30"
              >
                {sim.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sim.imageUrl}
                    alt={sim.title}
                    className="h-14 w-14 shrink-0 rounded-lg object-contain bg-white p-1 border border-gray-200"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-2 text-xs font-bold text-gray-800 group-hover:text-brand transition-colors">
                    {sim.title}
                  </p>
                  
                  {/* Variant or Mismatch reason */}
                  {sim.mismatchReason && (
                    <div className="mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block border border-amber-200/60">
                      {sim.mismatchReason}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-black text-brand">
                      {formatInr(sim.price, product?.country)}
                    </span>
                    <span className="rounded bg-gray-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-700">
                      {sim.merchant}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
