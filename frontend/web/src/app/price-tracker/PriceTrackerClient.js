'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/config';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';
import { formatInr } from '@/lib/affiliate';

export default function PriceTrackerClient({ popularSearches = [] }) {
  const router = useRouter();
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const isUrl = (text) => {
    const t = (text || '').trim().toLowerCase();
    return (
      t.startsWith('http://') ||
      t.startsWith('https://') ||
      t.includes('amazon.in') ||
      t.includes('amazon.com') ||
      t.includes('amzn.to') ||
      t.includes('amzn.in') ||
      t.includes('flipkart.com') ||
      t.includes('fkrt.co') ||
      t.includes('fkrt.it') ||
      t.includes('myntra.com') ||
      t.includes('nykaa.com') ||
      t.includes('ajio.com') ||
      t.includes('meesho.com') ||
      t.includes('croma.com') ||
      t.includes('shopsy.in')
    );
  };

  const handleTrackOrSearch = async (e, directText = null) => {
    if (e) e.preventDefault();
    const query = (directText || inputVal).trim();
    if (!query) return;

    setErrorMsg('');
    setScanResult(null);

    if (isUrl(query)) {
      setLoading(true);
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

          let pumpDetected = false;
          if (stats.verdict === 'WAIT') {
            pumpDetected = true;
          }

          setScanResult({
            productId: prod._id || prod.productId,
            title: prod.title || 'Tracked Product',
            merchant: prod.merchant || 'amazon',
            imageUrl: prod.imageUrl || (Array.isArray(prod.images) && prod.images[0]) || '',
            currentPrice: currentP,
            originalPrice: originalP,
            lowestPrice: lowestP,
            pumpDetected,
            isAllTimeLow: stats.isAllTimeLow || false,
            dropFromHighest: stats.dropFromHighest || 0,
          });
          setLoading(false);
          return;
        }

        // If not in lookup, try compare-url to auto-ingest and redirect
        const compRes = await fetch(`${API_BASE_URL}/api/products/compare-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const compData = await compRes.json();

        if (compData.success && compData.product && (compData.product._id || compData.product.productId)) {
          const targetId = compData.product._id || compData.product.productId;
          router.push(`/product/${targetId}?src=price_tracker`);
          return;
        }

        setErrorMsg(compData.error || 'Could not track this link yet. Please check the URL or try searching by product name.');
      } catch (err) {
        console.error('[Price Tracker Scan Error]', err);
        setErrorMsg('Network error while scanning product link. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // Normal search query: jump to catalog search
      router.push(`/products?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="w-full">
      {/* Primary Scanner Input Form */}
      <form onSubmit={handleTrackOrSearch} className="relative w-full max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center gap-2 rounded-2xl sm:rounded-full bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
          <div className="flex items-center w-full px-3 py-1">
            <span className="text-xl mr-2.5 shrink-0">🔍</span>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Paste any Amazon, Flipkart, Myntra, Nykaa link or search product..."
              className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              disabled={loading}
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  setScanResult(null);
                  setErrorMsg('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !inputVal.trim()}
            className="w-full sm:w-auto shrink-0 rounded-xl sm:rounded-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-7 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md hover:from-indigo-700 hover:to-violet-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Scanning…</span>
              </>
            ) : (
              <>
                <span>⚡ Track Price</span>
              </>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 text-left flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </form>

      {/* Real-time Scan Result Preview Card */}
      {scanResult && (
        <div className="mt-6 max-w-2xl mx-auto rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 shadow-sm text-left animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {scanResult.imageUrl && (
              <div className="h-20 w-20 shrink-0 rounded-xl bg-white p-2 border border-slate-200 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scanResult.imageUrl} alt={scanResult.title} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {renderStoreLogo(scanResult.merchant, 'h-3.5 w-auto object-contain')}
                <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
                  ✓ Product Found
                </span>
                {scanResult.isAllTimeLow && (
                  <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-black">
                    🔥 All-Time Low
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                {scanResult.title}
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-950">
                  {formatInr(scanResult.currentPrice)}
                </span>
                {scanResult.originalPrice > scanResult.currentPrice && (
                  <span className="text-xs text-slate-400 line-through">
                    {formatInr(scanResult.originalPrice)}
                  </span>
                )}
                {scanResult.lowestPrice < scanResult.currentPrice && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    Lowest recorded: {formatInr(scanResult.lowestPrice)}
                  </span>
                )}
              </div>
              {scanResult.pumpDetected && (
                <p className="mt-1 text-[11px] font-bold text-rose-600">
                  ⚠️ Price Pump Warning: Seller raised the price recently before this promotion.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/product/${scanResult.productId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-xs"
            >
              <span>📈 View 90-Day Price Chart</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Popular Quick Suggestions */}
      {popularSearches.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium">Popular tracked:</span>
          {popularSearches.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleTrackOrSearch(null, item)}
              className="rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* The URL Prefix Pro-Tip */}
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-100/90 border border-slate-200 px-3.5 py-1.5 text-[11px] text-slate-600 shadow-2xs">
        <span className="text-amber-500 font-bold">💡 Pro Tip:</span>
        <span>Add <strong className="font-mono text-indigo-700 font-bold">shoppersdeals.in/</strong> before any Amazon/Flipkart URL in your browser to track it instantly!</span>
      </div>
    </div>
  );
}
