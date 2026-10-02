'use client';

import React from 'react';

export default function V3SmartScannerBanner() {
  const features = [
    {
      step: '01',
      title: 'Spot price hikes before sales',
      desc: 'Sellers secretly hike prices 7 days before Amazon GIF / Flipkart BBD. Our scanner catches every spike.',
      icon: '📈',
    },
    {
      step: '02',
      title: 'Check if the price is inflated',
      desc: 'Compare against 90-day and 365-day historical baselines to verify if discount % is real.',
      icon: '🔍',
    },
    {
      step: '03',
      title: 'See the real effective price',
      desc: 'Factor in bank card offers, instant coupons, and cashback to compute final checkout cost.',
      icon: '🏷️',
    },
    {
      step: '04',
      title: 'Get quick verdict: Buy / Skip',
      desc: 'Our AI delivers an immediate verdict: Steal Deal, Good Buy, or Wait for Lower Price.',
      icon: '⚡',
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 my-8">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-[#1E1B4B] via-[#2E2875] to-[#4338CA] p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/30 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-indigo-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI Intelligence</span>
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">
              Smart Deal Scanner
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-indigo-200">
              Find genuine deals by budget, real price drop, and anti-inflation verification.
            </p>
          </div>
          <div className="shrink-0">
            <span className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300">
              100% Free Scanner
            </span>
          </div>
        </div>

        {/* 4 Feature Columns */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-all hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[11px] font-black text-indigo-300">STEP {item.step}</span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs text-indigo-200/90 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
