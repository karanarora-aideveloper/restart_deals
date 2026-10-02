'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';
import { trackSearch } from '@/lib/analytics';

export default function V3Hero() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [currentStoreIndex, setCurrentStoreIndex] = useState(0);

  const supportedStores = ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'Ajio', 'Meesho'];

  // Cycle supported store name in the magic URL tip every 2.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStoreIndex((prev) => (prev + 1) % supportedStores.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [supportedStores.length]);

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

  const handleSearchOrScan = async (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setScanError('');

    if (isStoreUrl(query)) {
      setIsScanning(true);
      trackSearch(query, 1, { is_url_scan: true, source: 'v3_hero' });
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/lookup-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();

        if (data.success && data.found && data.data) {
          const prod = data.data;
          router.push(`/product/${prod._id || prod.productId}`);
          return;
        }

        if (data.parsed && data.parsed.productId) {
          router.push(`/product/${data.parsed.productId}`);
          return;
        }

        setScanError(data.message || 'Product link received! Initializing price tracker...');
      } catch (err) {
        console.error('[V3Hero Scan Error]', err);
        setScanError('Unable to analyze store link. Please try searching by product name.');
      } finally {
        setIsScanning(false);
      }
    } else {
      trackSearch(query, 1, { is_url_scan: false, source: 'v3_hero' });
      router.push(`/products?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#EEF2FF]/70 via-white to-white pt-8 pb-10 sm:pt-12 sm:pb-14">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-64 bg-gradient-to-b from-indigo-200/20 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-4 text-center">
        {/* Sparkle Pill */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-white px-3.5 py-1 shadow-2xs">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" viewBox="0 0 17 16" fill="currentColor">
            <path d="m12.97 6.17.15-.4c.2-.56.27-.7.36-.8.1-.09.23-.15.8-.36l.4-.15v-.93l-.4-.15c-.57-.21-.7-.27-.8-.36-.1-.1-.15-.23-.36-.8l-.15-.4h-.94l-.15.4c-.2.57-.27.7-.36.8-.1.09-.23.15-.8.36l-.4.15v.94l.4.14c.57.21.7.27.8.37.1.1.15.23.36.8l.15.39h.94Zm-4.86 9.52.34-.93c.47-1.26.66-1.74 1-2.1.36-.34.84-.53 2.1-1L12 9.8v-.94l-.93-.34c-1.26-.47-1.75-.66-2.1-1-.34-.36-.53-.84-1-2.1l-.34-.93H6.7l-.35.93c-.46 1.26-.65 1.74-1 2.1s-.83.53-2.1 1l-.92.34v.94l.93.34c1.26.47 1.74.66 2.09 1 .35.36.54.84 1 2.1l.35.93h.94Z" />
          </svg>
          <h1 className="text-xs sm:text-sm font-bold tracking-tight text-indigo-700">
            Price History &amp; Tracker
          </h1>
        </div>

        {/* Primary Headline */}
        <p className="mt-3 text-2xl sm:text-4xl md:text-[40px] font-black leading-tight text-[#312F80] tracking-tight">
          Compare prices &amp; track drops across 1 Lakh+ stores
        </p>

        {/* Sub-Headline */}
        <p className="mt-1 text-sm sm:text-xl font-normal text-slate-800">
          Save instantly, everytime you shop!
        </p>

        {/* Central Search Box */}
        <div className="mx-auto mt-6 max-w-2xl min-w-0">
          <form
            onSubmit={handleSearchOrScan}
            className="relative flex items-center rounded-2xl border border-slate-200 bg-white p-1 sm:p-1.5 shadow-md shadow-indigo-100/50 transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 min-w-0"
          >
            <div className="flex flex-1 items-center px-2.5 sm:px-3 min-w-0">
              <svg className="h-4 sm:h-5 w-4 sm:w-5 text-slate-400 shrink-0 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search product or paste Amazon / Flipkart link"
                className="w-full bg-transparent py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden min-w-0"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || !searchInput.trim()}
              className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-[#5855E5] px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-all hover:bg-[#4743DE] disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Scanning</span>
                </>
              ) : (
                <span>Find Best Price</span>
              )}
            </button>
          </form>

          {scanError && (
            <p className="mt-2 text-xs font-semibold text-amber-700">{scanError}</p>
          )}

          {/* Trust Metrics with Dashed Dividers */}
          <div className="hidden md:flex items-center gap-2 mt-4 text-[#008357]">
            <div className="flex-1 border-t border-dashed border-slate-300" />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#008357]" />
              <strong className="font-black text-slate-900">8M+</strong> Active Users
            </span>
            <div className="flex-1 border-t border-dashed border-slate-300" />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#008357]" />
              <strong className="font-black text-slate-900">₹10K CR</strong> Cash Saved
            </span>
            <div className="flex-1 border-t border-dashed border-slate-300" />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#008357]" />
              <strong className="font-black text-slate-900">100K+</strong> Trusted Stores
            </span>
            <div className="flex-1 border-t border-dashed border-slate-300" />
          </div>

          {/* Mobile Trust Metrics */}
          <div className="flex md:hidden items-center justify-center gap-3 mt-3 text-[10px] font-semibold text-[#008357]">
            <span>✓ <strong className="text-slate-900">8M+</strong> Users</span>
            <span>✓ <strong className="text-slate-900">₹10K CR</strong> Saved</span>
            <span>✓ <strong className="text-slate-900">100K+</strong> Stores</span>
          </div>

          {/* Magic URL Prefix Trick Banner with clean fluid wrap */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1 mt-5 rounded-full border border-indigo-100 bg-gradient-to-r from-[#DDE9FF] via-white to-white px-3.5 py-1.5 text-[11px] sm:text-xs text-slate-900 shadow-2xs max-w-full">
            <span className="text-xs sm:text-sm">💡</span>
            <span className="font-bold">Find Best Price</span>
            <span>by adding</span>
            <span className="font-black text-indigo-700">shoppersdeals.in/</span>
            <span>before any link • Works with</span>
            <span className="font-bold text-indigo-700 underline decoration-indigo-300">
              {supportedStores[currentStoreIndex]}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
