import React from 'react';
import Link from 'next/link';
import { fetchProducts } from '@/lib/api';
import V3SubHeader from '@/components/v3/V3SubHeader';
import ProductCard from '@/components/ProductCard';
import PriceTrackerClient from './PriceTrackerClient';
import { SITE_URL } from '@/lib/config';

export const metadata = {
  title: 'Smart Price Tracker — Track Amazon, Flipkart & Myntra Prices | ShoppersDeals',
  description:
    'Paste any product link from Amazon, Flipkart, Myntra, or Nykaa to view 90-day price history charts, detect fake discounts, and set instant price drop alerts.',
  alternates: { canonical: `${SITE_URL}/price-tracker` },
};

export default async function PriceTrackerPage() {
  // Fetch top 12 curated/bestseller tracked products to showcase
  let topTrackedProducts = [];
  try {
    const res = await fetchProducts({
      limit: 12,
      sort: 'recently_checked',
      country: 'in',
    });
    topTrackedProducts = (res?.items || []).slice(0, 8);
  } catch (err) {
    console.error('[Price Tracker Page fetch error]', err);
  }

  const popularSearches = [
    'iPhone 16',
    'MacBook Air M3',
    'Sony WH-1000XM5',
    'boAt Rockerz',
    'Samsung Galaxy S24',
    'Maybelline Fit Me',
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 pb-16">
      {/* Navigation SubHeader */}
      <V3SubHeader activeTab="price-tracker" />

      {/* Hero Section */}
      <section className="mt-4 rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/50 to-indigo-50/20 p-6 sm:p-12 text-center shadow-xs">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/80 border border-indigo-200/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-3 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
            24/7 Automated Price Drop Radar
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Smart Price Tracker &amp; Drop Radar
          </h1>

          <p className="mt-3 text-xs sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Paste any link from Amazon, Flipkart, Myntra, or Nykaa. Inspect real 90-day price histories, expose fake festive sale discounts, and set instant Telegram alerts.
          </p>

          <div className="mt-8">
            <PriceTrackerClient popularSearches={popularSearches} />
          </div>
        </div>
      </section>

      {/* How Price Tracking Works */}
      <section className="mt-12">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            How Price Tracking Works
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Never get tricked by inflated MRPs or deceptive discount claims again.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-xl mb-3">
              📋
            </div>
            <h3 className="text-sm font-black text-slate-900">1. Paste Any Product URL</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Copy any product link from Amazon India, Flipkart, Myntra, Nykaa, or Meesho. Paste it into the radar above.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl mb-3">
              📉
            </div>
            <h3 className="text-sm font-black text-slate-900">2. Verify 90-Day History</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Our automated price history radar shows authentic historical highs and lows, revealing whether the discount is genuine or an inflated price pump.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl mb-3">
              🔔
            </div>
            <h3 className="text-sm font-black text-slate-900">3. Get Instant Price Alerts</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Set your target budget. The moment a seller cuts the price or a flash sale goes live, receive an instant alert on Telegram or browser push.
            </p>
          </div>
        </div>
      </section>

      {/* Top Tracked Products Grid */}
      {topTrackedProducts.length > 0 && (
        <section className="mt-14">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Popular Products Being Tracked Right Now
              </h2>
              <p className="text-xs text-slate-500">
                Bestselling gadgets and lifestyle items monitored 24/7 across major Indian stores.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              <span>Explore all 50,000+ products in Directory</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {topTrackedProducts.map((product) => (
              <ProductCard key={product._id || product.productId} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Cross-Link Banner to /products Catalog */}
      <section className="mt-14 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-indigo-50/70 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Complete Catalog</span>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
            Want to browse our entire 50,000+ product catalog with filters?
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Filter every single product by store (Amazon, Flipkart, Myntra, Nykaa), subcategory, minimum discount percentage, and customer ratings.
          </p>
        </div>
        <Link
          href="/products"
          className="shrink-0 rounded-2xl bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:bg-indigo-700 transition-all active:scale-95"
        >
          Open Product Directory →
        </Link>
      </section>
    </div>
  );
}
