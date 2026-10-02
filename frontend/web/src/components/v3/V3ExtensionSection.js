'use client';

import React from 'react';
import Link from 'next/link';

export default function V3ExtensionSection() {
  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#2A2478] to-[#5855E5] p-8 sm:p-12 text-white shadow-2xl">
        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Value Prop & CTAs */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-white/10 px-3.5 py-1 text-xs font-bold text-indigo-200">
              <span>⭐ Chrome Extension &amp; Mobile App</span>
            </div>

            <h2 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Never Overpay Online Again
            </h2>

            <p className="mt-3 text-base sm:text-lg text-indigo-100 max-w-xl leading-relaxed">
              Add the <strong>ShoppersDeals Smart Price Tracker</strong> to your browser. Automatically see 90-day price history charts right on Amazon, Flipkart, and Myntra so you never get tricked by fake discounts.
            </p>

            {/* Features checkmarks */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-semibold text-indigo-100">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span>Automatic 90-day price graphs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span>Auto-apply coupons at checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span>1-Click price drop alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 font-bold">✓</span>
                <span>100% Free &amp; privacy-focused</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/download"
                className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:scale-105 active:scale-95"
              >
                <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span>Add to Chrome — It’s Free</span>
              </Link>

              <Link
                href="/download"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                <span>📱 Android &amp; iOS App</span>
              </Link>
            </div>

            {/* Rating proof */}
            <div className="mt-6 flex items-center gap-3 text-xs text-indigo-200">
              <div className="flex text-amber-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span><strong>4.6 / 5 rating</strong> on Chrome Web Store</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">250,000+ Active Shoppers</span>
            </div>
          </div>

          {/* Right Column: Visual Product Extension Mockup */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/20 bg-slate-900/60 p-5 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-bold text-slate-300">amazon.in/dp/B0BDK...</span>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  Extension Active
                </span>
              </div>

              {/* Mockup Inside Card */}
              <div className="mt-4 rounded-xl bg-slate-800/80 p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white">Apple iPhone 15 (128 GB)</span>
                  <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                    📉 ₹8,901 DROP
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-black text-white">₹57,999</span>
                  <span className="text-xs line-through text-slate-400">₹69,900</span>
                  <span className="text-xs font-bold text-emerald-400">(17% off)</span>
                </div>

                {/* Simulated Price Graph */}
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span>90-Day Price Trend</span>
                    <span className="text-emerald-300">Lowest: ₹56,999</span>
                  </div>
                  <div className="h-16 w-full rounded-lg bg-slate-900/80 p-2 flex items-end justify-between gap-1 border border-white/5">
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

                <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-300 pt-2 border-t border-white/10">
                  <span>Verdict: <strong className="text-emerald-300">Good Time to Buy</strong></span>
                  <span className="text-indigo-300 underline cursor-pointer">Set ₹55,000 Alert</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
