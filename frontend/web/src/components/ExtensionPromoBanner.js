'use client';

import React from 'react';

export default function ExtensionPromoBanner() {
  return (
    <section className="my-10 overflow-hidden rounded-3xl border border-[#cbd5e1] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-6 sm:p-10 text-white shadow-xl">
      <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
        <div className="max-w-xl text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#fbbf24] backdrop-blur-xs">
            <span>✨</span> Browser Extension & App
          </span>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Never Miss a Price Drop While You Browse
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#94a3b8] sm:text-sm">
            Install the free ShoppersDeals extension. Whenever you visit Amazon or Flipkart, the 90-day price history graph and coupon auto-apply bar will appear right on the product page!
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-black text-white shadow-lg transition-opacity hover:opacity-90"
            >
              <span>🌐</span> Add to Chrome — It&apos;s Free
            </a>
            <a
              href="/support"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-white/10"
            >
              <span>📱</span> Get Android App
            </a>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] font-semibold text-[#94a3b8] lg:justify-start">
            <span>⭐ 4.8 Rating</span>
            <span>•</span>
            <span>🔒 100% Safe & Private</span>
            <span>•</span>
            <span>⚡ Zero Slowdown</span>
          </div>
        </div>

        {/* Visual 3D Mock Graphic */}
        <div className="relative flex w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white/5 p-3 shadow-2xl backdrop-blur-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/extension-promo.jpg"
            alt="ShoppersDeals Chrome Extension Live Price History Graph"
            className="h-48 sm:h-56 w-full rounded-xl object-cover shadow-lg"
            loading="lazy"
          />
          <div className="mt-3 flex w-full items-center justify-between px-1">
            <span className="text-xs font-black text-white">Smart Price Assistant</span>
            <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400">
              ✓ Active on Amazon &amp; FK
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
