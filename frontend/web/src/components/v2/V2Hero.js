'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';
import { trackSearch } from '@/lib/analytics';

export default function V2Hero({ onFilterChange, activeCategory = 'all' }) {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [activeTool, setActiveTool] = useState('tracker'); // tracker | compare | alerts | coupons

  const isStoreUrl = (text) => {
    const val = (text || '').trim().toLowerCase();
    return (
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.includes('amazon.') ||
      val.includes('amzn.to') ||
      val.includes('flipkart.com') ||
      val.includes('fkrt.it') ||
      val.includes('myntra.com') ||
      val.includes('nykaa.com') ||
      val.includes('ajio.com') ||
      val.includes('meesho.com')
    );
  };

  const handleScanOrSearch = async (e) => {
    e.preventDefault();
    const query = urlInput.trim();
    if (!query) return;

    setScanError('');
    setScanResult(null);

    // If it's a URL, execute live product lookup
    if (isStoreUrl(query)) {
      setIsScanning(true);
      trackSearch(query, 1, { is_url_scan: true });
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/lookup-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();

        if (data.success && data.found && data.data) {
          const prod = data.data;
          setScanResult(prod);
          // Auto route to canonical product after brief visual confirmation
          setTimeout(() => {
            router.push(`/product/${prod._id || prod.productId}`);
          }, 600);
          return;
        }

        if (data.parsed && data.parsed.productId) {
          router.push(`/product/${data.parsed.productId}`);
          return;
        }

        setScanError(data.message || 'Product currently being indexed. Try searching by product name.');
      } catch (err) {
        console.error('[V2Hero Scan Error]', err);
        setScanError('Unable to analyze store link right now. Please try again or search by product name.');
      } finally {
        setIsScanning(false);
      }
    } else {
      // It's a keyword search: route directly to full catalog
      trackSearch(query, 1, { is_url_scan: false });
      router.push(`/products?q=${encodeURIComponent(query)}`);
    }
  };

  const quickCategories = [
    { id: 'all', label: 'All Deals', icon: '🔥' },
    { id: 'electronics', label: 'Smartphones & Tech', icon: '📱' },
    { id: 'fashion', label: 'Fashion & Apparel', icon: '👗' },
    { id: 'beauty', label: 'Beauty & Makeup', icon: '💄' },
    { id: 'home', label: 'Home & Kitchen', icon: '🏠' },
    { id: 'fitness', label: 'Gym & Sports', icon: '💪' },
  ];

  return (
    <section className="relative w-full overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-[#f8fafc] via-[#fdfefe] to-white py-10 md:py-16">
      {/* Subtle ambient lighting decorative blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-100/40 via-indigo-100/30 to-amber-100/40 blur-3xl" />

      <div className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
        {/* Clean Pill Header */}
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/70 px-4 py-1.5 shadow-2xs">
          <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
          <span className="text-[12px] font-extrabold uppercase tracking-wide text-brand">
            Autonomous Deal Radar &amp; 90-Day Price Tracker
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Shop Smarter. <span className="bg-gradient-to-r from-[#FF6B00] to-[#ea580c] bg-clip-text text-transparent">Never Pay Inflated Prices.</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-3.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base md:text-lg">
          We monitor 100K+ products across Amazon, Flipkart, Myntra &amp; Nykaa 24/7. Compare real prices, detect fake discounts, and grab verified drops.
        </p>

        {/* Central Search & URL Scanner Box */}
        <div className="mx-auto mt-8 max-w-3xl">
          <form
            onSubmit={handleScanOrSearch}
            className="relative flex flex-col sm:flex-row items-center gap-2 rounded-2xl sm:rounded-full border border-slate-300 bg-white p-2 shadow-lg shadow-slate-200/60 ring-4 ring-slate-100/80 transition-all focus-within:border-brand focus-within:ring-orange-100"
          >
            <div className="flex w-full flex-1 items-center px-3 py-1">
              {isScanning ? (
                <svg className="h-5 w-5 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste any Amazon / Flipkart product link, or search deals..."
                className="ml-3 w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {!!urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput('')}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear input"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isScanning || !urlInput.trim()}
              className="w-full sm:w-auto shrink-0 rounded-xl sm:rounded-full bg-brand px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-[#e05d00] hover:shadow-orange-500/30 disabled:opacity-50"
            >
              {isScanning ? 'Analyzing...' : isStoreUrl(urlInput) ? 'Track Price 📈' : 'Find Deals ⚡'}
            </button>
          </form>

          {/* Scan Result Feedback banner */}
          {scanResult && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-left">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 text-lg">✓</span>
                <span className="text-xs font-bold text-emerald-800">
                  Found &quot;{scanResult.title?.slice(0, 50)}...&quot; — Redirecting to 90-day price history...
                </span>
              </div>
            </div>
          )}

          {scanError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-left">
              <span className="text-amber-600 text-base">⚠️</span>
              <span className="text-xs font-semibold text-amber-800">{scanError}</span>
            </div>
          )}
        </div>

        {/* 4 Buyhatke-Style Feature Cards */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            onClick={() => setActiveTool('tracker')}
            className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-all ${
              activeTool === 'tracker'
                ? 'border-brand bg-orange-50/50 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <span className="text-2xl">📉</span>
            <h3 className="mt-2 text-xs sm:text-sm font-extrabold text-slate-900">Price History</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">90-day authentic price chart to expose fake discounts.</p>
          </div>

          <div
            onClick={() => setActiveTool('compare')}
            className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-all ${
              activeTool === 'compare'
                ? 'border-brand bg-orange-50/50 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <span className="text-2xl">⚖️</span>
            <h3 className="mt-2 text-xs sm:text-sm font-extrabold text-slate-900">Price Comparison</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Amazon vs Flipkart vs Myntra vs Nykaa side-by-side.</p>
          </div>

          <div
            onClick={() => setActiveTool('alerts')}
            className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-all ${
              activeTool === 'alerts'
                ? 'border-brand bg-orange-50/50 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <span className="text-2xl">🔔</span>
            <h3 className="mt-2 text-xs sm:text-sm font-extrabold text-slate-900">Price Drop Alerts</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Instant notification when any product hits your target.</p>
          </div>

          <div
            onClick={() => setActiveTool('coupons')}
            className={`cursor-pointer rounded-2xl border p-3.5 text-left transition-all ${
              activeTool === 'coupons'
                ? 'border-brand bg-orange-50/50 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            <span className="text-2xl">🏷️</span>
            <h3 className="mt-2 text-xs sm:text-sm font-extrabold text-slate-900">Bank &amp; Coupons</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Auto-detected card discounts and coupon codes.</p>
          </div>
        </div>

        {/* Trust Proof Points Rail */}
        <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/80">
            <span>🛡️</span>
            <span>100% Genuine Drop Math</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200/80">
            <span>⚡</span>
            <span>Live 24/7 Store Sync</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200/80">
            <span>🚀</span>
            <span>Native App Deep-Linking</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <span>₹</span>
            <span>Zero Fees &bull; Completely Free</span>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2">
          {quickCategories.map((c) => {
            const isSelected = activeCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onFilterChange?.(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
