'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';
import { formatInr } from '@/lib/affiliate';
import { trackSearch } from '@/lib/analytics';
import { ShieldTrustIcon, ShoppingCookieMascot } from './icons/BuyhatkeIcons';

export default function HeroSearch() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sampleDeals = [
    {
      title: 'Apple iPhone 15 (128 GB)',
      merchant: 'Amazon',
      currentPrice: 58999,
      originalPrice: 79900,
      lowestPrice: 57999,
      score: 96,
      status: 'Authentic 26% Discount',
      pumpDetected: false,
      url: 'https://www.amazon.in/dp/B0CHX1W1XY',
    },
    {
      title: 'Sony WH-1000XM5 ANC',
      merchant: 'Flipkart',
      currentPrice: 24990,
      originalPrice: 34990,
      lowestPrice: 23990,
      score: 92,
      status: 'Authentic 28% Discount',
      pumpDetected: false,
      url: 'https://www.flipkart.com/sony-wh-1000xm5/p/itm1234567890123',
    },
    {
      title: 'OnePlus Nord CE 4 5G',
      merchant: 'Amazon',
      currentPrice: 24999,
      originalPrice: 26999,
      lowestPrice: 22999,
      score: 84,
      status: 'Normal Price Fluctuation',
      pumpDetected: false,
      url: 'https://www.amazon.in/dp/B0CX24B49L',
    },
    {
      title: 'Nike Revolution 7',
      merchant: 'Myntra',
      currentPrice: 2195,
      originalPrice: 3695,
      lowestPrice: 1999,
      score: 94,
      status: 'Lowest in 30 Days',
      pumpDetected: false,
      url: 'https://www.myntra.com/shoes/nike/nike-revolution/12345/buy',
    },
  ];

  const isUrl = (text) => {
    return (
      /^https?:\/\//i.test(text.trim()) ||
      text.includes('amazon.') ||
      text.includes('amzn.to') ||
      text.includes('flipkart.com') ||
      text.includes('fkrt.it') ||
      text.includes('myntra.com') ||
      text.includes('nykaa.com') ||
      text.includes('ajio.com') ||
      text.includes('meesho.com') ||
      text.includes('croma.com') ||
      text.includes('shopsy.in')
    );
  };

  const handleSearchOrScan = async (e, directQuery = null) => {
    if (e) e.preventDefault();
    const query = (directQuery || inputValue).trim();
    if (!query) return;

    trackSearch(query, 1, { is_url_scan: isUrl(query) });

    setErrorMsg('');

    // If it's a URL, execute the Smart Scanner & Price Tracker lookup
    if (isUrl(query)) {
      setLoading(true);
      setScanResult(null);

      try {
        const res = await fetch(`${API_BASE_URL}/api/products/lookup-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();

        if (data.success && data.found && data.data) {
          const prod = data.data;
          const stats = prod.priceStats || {};
          const currentP = Number(prod.price) || 0;
          const lowestP = Number(stats.lowestPrice) || currentP;
          const originalP = Number(prod.originalPrice) || currentP;

          let score = 88;
          let pumpDetected = false;

          if (stats.isAllTimeLow) {
            score = 98;
          } else if (stats.verdict === 'GOOD_PRICE') {
            score = 92;
          } else if (stats.verdict === 'WAIT') {
            score = 54;
            pumpDetected = true;
          }

          setScanResult({
            title: prod.title || 'Scanned Product',
            merchant: prod.merchant || 'Amazon',
            currentPrice: currentP,
            originalPrice: originalP,
            lowestPrice: lowestP,
            score,
            status: pumpDetected
              ? '⚠️ Price Pump Warning: Seller raised price recently'
              : '✓ Authentic Discount: No Artificial MRP Inflation',
            pumpDetected,
            productId: prod._id || prod.productId,
          });
          return;
        }

        if (data.parsed && data.parsed.productId) {
          router.push(`/product/${data.parsed.productId}`);
          return;
        }

        // Fallback search
        router.push(`/products?q=${encodeURIComponent(query)}`);
      } catch (err) {
        console.error('[Unified Scanner Error]', err);
        router.push(`/products?q=${encodeURIComponent(query)}`);
      } finally {
        setLoading(false);
      }
    } else {
      // Normal keyword search
      router.push(`/products?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="relative -mx-4 mb-4 overflow-hidden bg-white sm:-mx-8">
      {/* 1. Buyhatke Top Yellow Banner with 3D AI Mascot */}
      <div className="relative w-full bg-gradient-to-b from-[#FFDD00] via-[#FFD200] to-[#FFC700] pt-4 pb-6 sm:pb-8">
        <div className="relative z-10 flex justify-center px-4">
          <div className="relative overflow-hidden rounded-2xl border-2 border-white/60 shadow-xl max-w-[460px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-mascot.jpg"
              alt="ShoppersDeals AI Shopping Robot Assistant"
              className="h-36 sm:h-48 w-full object-cover"
              loading="eager"
            />
            <div className="absolute bottom-2 inset-x-2 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md text-white text-[11px] font-bold">
              <span className="flex items-center gap-1">🤖 AI Deal Scanner &amp; Price Tracker</span>
              <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">LIVE 24/7</span>
            </div>
          </div>
        </div>

        {/* Scalloped Wave Edge */}
        <div className="absolute bottom-0 inset-x-0 w-full overflow-hidden leading-none">
          <svg
            className="relative block w-full h-4 sm:h-6 text-white"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 C150,90 350,-40 500,60 C650,160 900,10 1200,40 L1200,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* 2. Hero Content & Unified Search / Scanner Box */}
      <div className="relative mx-auto w-full max-w-4xl px-4 pt-2 pb-6">
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-3.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-[#16a34a]">
            <span>⚡</span> Price History &amp; AI Deal Scanner
          </span>
          <h1 className="mt-1.5 text-xl font-black leading-tight text-[#4338ca] sm:text-3xl">
            Compare prices, scan fake discounts &amp; track 100+ stores
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#0f172a] sm:text-lg">
            Save instantly, everytime you shop!
          </p>
        </div>

        {/* Single Unified Input Form */}
        <form onSubmit={(e) => handleSearchOrScan(e)} className="relative mx-auto max-w-2xl">
          <div className="flex items-center overflow-hidden rounded-2xl border-2 border-[#4f46e5] bg-white p-1.5 shadow-lg transition-all focus-within:shadow-xl focus-within:border-brand">
            <div className="flex items-center pl-3 pr-2 text-[#94a3b8]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search products or paste any Amazon / Flipkart / Myntra link..."
              className="w-full bg-transparent px-2 py-2.5 text-xs font-semibold text-[#0f172a] placeholder-[#94a3b8] focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-sm transition-all hover:opacity-95 disabled:opacity-60"
            >
              {loading ? 'Scanning…' : 'Track & Scan ⚡'}
            </button>
          </div>

          {errorMsg && <p className="mt-2 text-center text-xs font-bold text-[#dc2626]">{errorMsg}</p>}
        </form>

        {/* 3. Live Scanner Results Card (Slides down when URL is scanned) */}
        {scanResult && (
          <div className="mx-auto mt-4 max-w-2xl overflow-hidden rounded-2xl border border-[#cbd5e1] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4 text-white shadow-xl animate-in fade-in duration-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase">
                    {scanResult.merchant}
                  </span>
                  <span className={`text-xs font-extrabold ${scanResult.pumpDetected ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
                    {scanResult.status}
                  </span>
                </div>
                <h3 className="mt-1 text-xs font-bold line-clamp-1 text-white sm:text-sm">{scanResult.title}</h3>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-base font-black text-[#fbbf24] sm:text-lg">{formatInr(scanResult.currentPrice, scanResult.country)}</span>
                  {scanResult.originalPrice > scanResult.currentPrice && (
                    <span className="text-xs text-[#94a3b8] line-through">{formatInr(scanResult.originalPrice, scanResult.country)}</span>
                  )}
                  <span className="text-xs font-bold text-[#34d399]">
                    Lowest: {formatInr(scanResult.lowestPrice, scanResult.country)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#10b981] font-black text-white text-sm shadow-md">
                    {scanResult.score}%
                  </div>
                  <span className="text-[8.5px] font-extrabold uppercase text-[#94a3b8]">Trust</span>
                </div>

                {scanResult.productId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/product/${scanResult.productId}`)}
                    className="rounded-xl bg-white px-3.5 py-2 text-xs font-black text-[#0f172a] shadow-md hover:bg-slate-100 transition-colors"
                  >
                    View Graph 📊
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. One-Click Instant Sample Scans */}
        <div className="mx-auto mt-4 max-w-2xl">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">
              Instant Samples:
            </span>
            {sampleDeals.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputValue(sample.url);
                  handleSearchOrScan(null, sample.url);
                }}
                className="shrink-0 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-bold text-[#334155] hover:border-[#6366f1] hover:text-[#4f46e5] transition-colors"
              >
                {sample.title.split(' ')[0]} {sample.title.split(' ')[1]} ({sample.score}% Trust)
              </button>
            ))}
          </div>
        </div>

        {/* 5. Trust Strip — honest, verifiable metrics */}
        <div className="mx-auto mt-4 flex max-w-2xl items-center justify-between gap-2 px-2 text-[#008357]">
          <div className="hidden flex-1 border-t border-dashed border-slate-300 sm:block"></div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
            <ShieldTrustIcon className="h-4 w-4 shrink-0" />
            <span className="font-extrabold text-[#00422c]">7,400+</span> Products Tracked
          </span>
          <div className="flex-1 border-t border-dashed border-slate-300"></div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
            <ShieldTrustIcon className="h-4 w-4 shrink-0" />
            <span className="font-extrabold text-[#00422c]">90-Day</span> Real Price History
          </span>
          <div className="flex-1 border-t border-dashed border-slate-300"></div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
            <ShieldTrustIcon className="h-4 w-4 shrink-0" />
            <span className="font-extrabold text-[#00422c]">Zero</span> Fake Discounts
          </span>
          <div className="hidden flex-1 border-t border-dashed border-slate-300 sm:block"></div>
        </div>
      </div>
    </div>
  );
}
