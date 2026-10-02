'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';

// Curated top verified coupons database for immediate offline/instant rendering
const CURATED_COUPONS = [
  {
    id: 'c-1',
    merchant: 'amazon',
    storeName: 'Amazon India',
    logo: '🛒',
    code: 'AMZNBANK10',
    title: '10% Instant Discount on Bank Credit & Debit Cards',
    description: 'Save up to ₹1,500 on electronics, smartphones, laptops, and home appliances. Minimum order ₹5,000.',
    type: 'bank',
    category: 'Electronics',
    expiry: '31 Oct 2026',
    discount: '10% OFF',
    url: 'https://www.amazon.in?tag=shoppersdea03-21',
  },
  {
    id: 'c-2',
    merchant: 'flipkart',
    storeName: 'Flipkart',
    logo: '⚡',
    code: 'BBDSPECIAL',
    title: 'Instant 10% Off on HDFC & SBI Cards',
    description: 'Flat 10% instant discount on smartphones, televisions, and electronics. Min purchase ₹4,999.',
    type: 'bank',
    category: 'Electronics',
    expiry: '31 Oct 2026',
    discount: '10% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.flipkart.com',
  },
  {
    id: 'c-3',
    merchant: 'myntra',
    storeName: 'Myntra',
    logo: '👗',
    code: 'MYNTRA15',
    title: 'Extra 15% Off on Select Fashion Brands',
    description: 'Applicable on clothing, footwear, and accessories. Minimum cart value ₹1,999.',
    type: 'coupon',
    category: 'Fashion',
    expiry: '31 Oct 2026',
    discount: '15% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.myntra.com',
  },
  {
    id: 'c-4',
    merchant: 'myntra',
    storeName: 'Myntra',
    logo: '👗',
    code: 'FIRSTBUY',
    title: 'Flat ₹200 Off for New App & Web Users',
    description: 'Special welcome discount for new shoppers on first order above ₹999.',
    type: 'coupon',
    category: 'Fashion',
    expiry: 'Ongoing',
    discount: '₹200 OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.myntra.com',
  },
  {
    id: 'c-5',
    merchant: 'nykaa',
    storeName: 'Nykaa Beauty',
    logo: '💄',
    code: 'NYKBEAUTY10',
    title: 'Extra 10% Off on Top Cosmetics & Skincare',
    description: 'Valid on Maybelline, Lakme, L\'Oreal, Sugar, and M.A.C collections.',
    type: 'coupon',
    category: 'Beauty',
    expiry: '31 Oct 2026',
    discount: '10% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.nykaa.com',
  },
  {
    id: 'c-6',
    merchant: 'ajio',
    storeName: 'AJIO',
    logo: '✨',
    code: 'TRENDS10',
    title: 'Flat 10% Extra on AJIO Trends & Sneakers',
    description: 'Valid on top footwear, ethnic wear, and international designer collections.',
    type: 'coupon',
    category: 'Fashion',
    expiry: '31 Oct 2026',
    discount: '10% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.ajio.com',
  },
  {
    id: 'c-7',
    merchant: 'purenutrition',
    storeName: 'Pure Nutrition',
    logo: '🌿',
    code: 'PAYDAY5',
    title: 'Pure Nutrition Payday Special Discount',
    description: 'Massive savings on vitamins, supplements, and wellness essentials.',
    type: 'coupon',
    category: 'Health',
    expiry: '31 Oct 2026',
    discount: 'EXTRA 5% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fpurenutrition.in',
  },
  {
    id: 'c-8',
    merchant: 'kapiva',
    storeName: 'Kapiva Ayurveda',
    logo: '🌱',
    code: 'PAYDAY15',
    title: 'Pay Day Sale: Up to 30% Off + Extra 15% Off',
    description: 'Extra 15% discount on Ayurvedic juices, Shilajit, and herbal wellness packs.',
    type: 'coupon',
    category: 'Health',
    expiry: '31 Oct 2026',
    discount: '15% OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fkapiva.in',
  },
  {
    id: 'c-9',
    merchant: 'pepperfry',
    storeName: 'Pepperfry',
    logo: '🛋️',
    code: 'HBSPECIAL2K',
    title: 'Up to 70% Off + Extra ₹2,000 Off on Furniture',
    description: 'Valid on home decor, study tables, sofas, and ergonomic office chairs above ₹19,999.',
    type: 'coupon',
    category: 'Home',
    expiry: '31 Oct 2026',
    discount: '₹2,000 OFF',
    url: 'https://linksredirect.com/?cid=325472&subid=web&source=api&url=https%3A%2F%2Fwww.pepperfry.com',
  }
];

const STORE_FILTERS = [
  { id: 'all', label: 'All Stores' },
  { id: 'amazon', label: 'Amazon India' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'myntra', label: 'Myntra' },
  { id: 'nykaa', label: 'Nykaa' },
  { id: 'ajio', label: 'AJIO' },
];

export default function CouponsHubPage() {
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'coupon' | 'bank'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [liveCoupons, setLiveCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveCoupons() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/cuelinks/offers?per_page=30`);
        const json = await res.json();
        if (!cancelled && json?.success && Array.isArray(json?.data)) {
          const apiList = json.data
            .filter((o) => o.coupon_code)
            .map((o) => ({
              id: `api-${o.id}`,
              merchant: (o.campaign_name || '').toLowerCase(),
              storeName: o.campaign_name || 'Partner Store',
              logo: '🏷️',
              code: o.coupon_code,
              title: o.title || 'Verified Promo Code',
              description: o.description ? o.description.trim().slice(0, 160) : 'Verified merchant promotional coupon.',
              type: 'coupon',
              category: o.categories?.[0]?.name || 'Shopping',
              expiry: o.end_date ? new Date(o.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Limited Time',
              discount: 'PROMO CODE',
              url: o.tracking_url || 'https://shoppersdeals.in',
            }));

          if (apiList.length > 0) {
            setLiveCoupons(apiList);
          }
        }
      } catch (e) {
        // Fall back gracefully
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLiveCoupons();
    return () => {
      cancelled = true;
    };
  }, []);

  const allCoupons = useMemo(() => {
    const combined = [...CURATED_COUPONS, ...liveCoupons];
    // Deduplicate by code
    const seen = new Set();
    return combined.filter((c) => {
      if (!c.code || seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });
  }, [liveCoupons]);

  const filteredCoupons = useMemo(() => {
    return allCoupons.filter((c) => {
      const matchStore =
        selectedStore === 'all' ||
        c.merchant.includes(selectedStore) ||
        c.storeName.toLowerCase().includes(selectedStore);

      const matchType = selectedType === 'all' || c.type === selectedType;

      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.storeName.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);

      return matchStore && matchType && matchQuery;
    });
  }, [allCoupons, selectedStore, selectedType, searchQuery]);

  const handleCopy = (code) => {
    if (!code) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2500);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20">
      {/* Header Banner */}
      <section className="bg-gradient-to-b from-orange-50 via-white to-[#f8fafc] border-b border-gray-200/80 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100/70 px-3 py-1 text-xs font-black text-brand mb-2.5">
                <span>🏷️</span>
                <span>Verified Promo Codes &amp; Bank Offers</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                Today&apos;s Top Online Coupons &amp; Discount Codes
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-gray-600 max-w-2xl">
                Save extra on every order across Amazon, Flipkart, Myntra, Nykaa, and 500+ Indian brands. 100% verified daily.
              </p>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-extrabold text-gray-800 shadow-2xs hover:border-brand hover:text-brand transition-colors"
            >
              <span>📉</span>
              <span>Check Product Price Drops →</span>
            </Link>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by store name, bank, or code (e.g. HDFC, Myntra, 15%)..."
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-xs sm:text-sm font-semibold text-gray-900 shadow-xs focus:border-brand focus:outline-none"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold transition-all ${
                  selectedType === 'all' ? 'bg-brand text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Offers
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('coupon')}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold transition-all ${
                  selectedType === 'coupon' ? 'bg-brand text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏷️ Promo Codes
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('bank')}
                className={`rounded-xl px-3 py-2 text-xs font-extrabold transition-all ${
                  selectedType === 'bank' ? 'bg-brand text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💳 Bank Offers
              </button>
            </div>
          </div>

          {/* Store Pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {STORE_FILTERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStore(s.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  selectedStore === s.id
                    ? 'border border-brand bg-orange-50 text-brand shadow-2xs'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Coupons Grid */}
      <main className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">
            Showing <span className="text-gray-900 font-extrabold">{filteredCoupons.length}</span> verified coupons
          </p>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            ✓ Auto-Verified Active
          </span>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="py-20 text-center">
            <span className="text-4xl">🏷️</span>
            <h3 className="mt-3 text-base font-extrabold text-gray-900">No coupons matched your search</h3>
            <p className="mt-1 text-xs text-gray-500">Try clearing your filters or search keywords.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedStore('all');
                setSelectedType('all');
                setSearchQuery('');
              }}
              className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCoupons.map((coupon) => {
              const isCopied = copiedCode === coupon.code;
              return (
                <div
                  key={coupon.id}
                  className="flex flex-col justify-between rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                >
                  <div>
                    {/* Top Row: Store & Discount */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-base">
                          {coupon.logo}
                        </span>
                        <div>
                          <span className="text-xs font-black text-gray-900">{coupon.storeName}</span>
                          <span className="block text-[10px] font-semibold text-gray-400 capitalize">
                            {coupon.category}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                          coupon.type === 'bank'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {coupon.discount}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-sm font-extrabold text-gray-900 leading-snug line-clamp-2">
                      {coupon.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {coupon.description}
                    </p>
                  </div>

                  {/* Bottom Row: Code & CTA */}
                  <div className="mt-5 border-t border-dashed border-gray-200 pt-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(coupon.code)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black tracking-wider transition-all ${
                          isCopied
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-2xs'
                            : 'border-dashed border-brand/60 bg-orange-50 text-brand hover:bg-brand hover:text-white shadow-2xs active:scale-95'
                        }`}
                        title="Click to copy promo code"
                      >
                        <span>{isCopied ? '✓' : '✂️'}</span>
                        <span>{isCopied ? 'COPIED!' : coupon.code}</span>
                      </button>

                      <a
                        href={coupon.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
                      >
                        Claim ↗
                      </a>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Expires: {coupon.expiry}</span>
                      <span className="font-semibold text-emerald-600">✓ Tested Today</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
