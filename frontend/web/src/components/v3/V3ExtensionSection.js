'use client';

import React from 'react';
import Link from 'next/link';

export default function V3ExtensionSection() {
  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1B4B] via-[#2A2478] to-[#5855E5] p-5 sm:p-7 lg:p-8 text-white shadow-xl">
        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Value Prop & CTAs */}
          <div className="lg:col-span-7 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-white/10 px-3 py-0.5 text-xs font-bold text-indigo-200">
              <span>⭐ Chrome Extension &amp; Mobile App</span>
            </div>

            <h2 className="mt-3 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
              Never Overpay Online Again
            </h2>

            <p className="mt-2 text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed">
              Add the <strong>ShoppersDeals Smart Price Tracker</strong> to your browser. Automatically see 90-day price history charts right on Amazon, Flipkart, and Myntra so you never get tricked by fake discounts.
            </p>

            {/* Features checkmarks */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-semibold text-indigo-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span className="truncate">Automatic 90-day price graphs</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span className="truncate">Auto-apply coupons at checkout</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span className="truncate">1-Click price drop alerts</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span className="truncate">100% Free &amp; privacy-focused</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/download"
                className="flex items-center gap-2 rounded-2xl bg-white px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:scale-105 active:scale-95"
              >
                <svg className="h-5 w-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span>Add to Chrome — It’s Free</span>
              </Link>

              <Link
                href="/download"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                <span>📱 Android &amp; iOS App</span>
              </Link>
            </div>

            {/* Rating proof */}
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-indigo-200">
              <div className="flex text-amber-400 shrink-0">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span><strong>4.6 / 5 rating</strong> on Chrome Web Store</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">250,000+ Active Shoppers</span>
            </div>
          </div>

          {/* Right Column: Visual Product Extension Mockup (Robust against overflow) */}
          <div className="lg:col-span-5 min-w-0">
            <div className="rounded-2xl border border-white/20 bg-slate-900/70 p-4 sm:p-5 backdrop-blur-md shadow-2xl min-w-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="ml-1 text-[11px] font-bold text-slate-300 truncate">amazon.in/dp/B0BDK...</span>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300 shrink-0">
                  Extension Active
                </span>
              </div>

              {/* Mockup Inside Card */}
              <div className="mt-3.5 rounded-xl bg-slate-800/80 p-3 sm:p-4 border border-white/10 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-extrabold text-white truncate">Apple iPhone 15 (128 GB)</span>
                  <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-slate-950 shrink-0">
                    📉 ₹8,901 DROP
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg sm:text-xl font-black text-white">₹57,999</span>
                  <span className="text-xs line-through text-slate-400">₹69,900</span>
                  <span className="text-xs font-bold text-emerald-400">(17% off)</span>
                </div>

                {/* Simulated Price Graph */}
                <div className="mt-3 min-w-0">
                  <div className="flex justify-between text-[9px] sm:text-[10px] font-bold text-slate-400 mb-1">
                    <span>90-Day Price Trend</span>
                    <span className="text-emerald-300">Lowest: ₹56,999</span>
                  </div>
                  <div className="h-14 w-full rounded-lg bg-slate-900/80 p-2 flex items-end justify-between gap-1 border border-white/5">
                    {[65, 64, 62, 63, 61, 60, 62, 60, 58, 59, 57].map((val, i) => (
                      <div
                        key={i}
                        style={{ height: `${val}%` }}
                        className={`w-full rounded-t-xs ${
                          i === 10 ? 'bg-emerald-400' : 'bg-indigo-400/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-300 pt-2 border-t border-white/10 min-w-0">
                  <span className="truncate">Verdict: <strong className="text-emerald-300">Steal Buy</strong></span>
                  <span className="text-indigo-300 underline cursor-pointer shrink-0">Set ₹55K Alert</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
