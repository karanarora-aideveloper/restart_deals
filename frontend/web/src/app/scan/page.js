import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL, SITE_URL } from '@/lib/config';
import ScanInputClient from './ScanInputClient';

export const metadata = {
  title: 'Smart Product Scanner & Price History Radar | ShoppersDeals',
  description:
    'Paste any product link or prepend shoppersdeals.in/ before any Amazon, Flipkart, Meesho, or Myntra URL to instantly discover price history and lowest prices.',
  alternates: { canonical: `${SITE_URL}/scan` },
};

export default async function ScanPage({ searchParams }) {
  const sp = await searchParams;
  const targetUrl = sp?.url ? decodeURIComponent(sp.url).trim() : '';

  let scanError = null;

  if (targetUrl) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/compare-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        cache: 'no-store',
      });

      const data = await res.json();

      if (data.success && data.product && (data.product._id || data.product.productId)) {
        const targetId = data.product._id || data.product.productId;
        redirect(`/product/${targetId}?src=url_prefix`);
      } else {
        scanError = data.error || 'Could not resolve this product link. Please make sure it is a valid product page.';
      }
    } catch (err) {
      // If Next.js redirect threw NEXT_REDIRECT, re-throw it so the redirect completes
      if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
        throw err;
      }
      scanError = 'Unable to connect to price comparison radar. Please try again.';
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAFC] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Header Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xl text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200 text-3xl shadow-xs mb-4">
            ⚡
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Smart Deal Scanner &amp; Price Radar
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            Discover real 90-day price history, detect fake MRP inflation, and find the lowest price across Amazon, Flipkart, Meesho, Myntra &amp; Nykaa.
          </p>

          {/* Error Message if a specific URL failed */}
          {scanError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-bold text-rose-900">Scanning Issue</p>
                  <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{scanError}</p>
                  {targetUrl && (
                    <p className="mt-1 text-[11px] font-mono text-rose-500 break-all">
                      {targetUrl}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Interactive URL Input Form */}
          <div className="mt-8">
            <ScanInputClient initialUrl={targetUrl} />
          </div>

          {/* Pro-Tip Box Highlighting the Magic Trick */}
          <div className="mt-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-indigo-50/60 p-4 text-left">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">💡</span>
              <div>
                <p className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  The Magic URL Prefix Trick
                </p>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                  Whenever you are browsing Amazon, Flipkart, or Meesho on desktop or mobile, simply add{' '}
                  <strong className="font-mono text-indigo-700 font-black">shoppersdeals.in/</strong>{' '}
                  before any product link in your browser bar.
                </p>
                <div className="mt-2.5 rounded-lg bg-white/80 border border-indigo-200/80 px-3 py-1.5 font-mono text-[11px] text-slate-800 break-all">
                  <span className="text-indigo-600 font-bold">shoppersdeals.in/</span>
                  <span className="text-slate-500">https://www.meesho.com/s/p/4v9k9</span>
                </div>
              </div>
            </div>
          </div>

          {/* Supported Stores Badges */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Works seamlessly with all top Indian stores
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Nykaa', 'Ajio', 'Croma'].map((store) => (
                <span
                  key={store}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  ✓ {store}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to ShoppersDeals Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
