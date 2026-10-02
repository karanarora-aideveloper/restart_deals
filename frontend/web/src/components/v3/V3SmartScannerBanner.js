'use client';

import React from 'react';

export default function V3SmartScannerBanner() {
  const features = [
    {
      step: '01',
      title: 'Spot Price Hikes Before Sales',
      desc: 'Detects secret MRP markups 7 days prior to Amazon GIF and Flipkart BBD sales.',
      icon: '📈',
    },
    {
      step: '02',
      title: 'Verify Real Discount %',
      desc: 'Compares current price against 90-day moving averages to expose artificial claims.',
      icon: '🔍',
    },
    {
      step: '03',
      title: 'Real Effective Price',
      desc: 'Calculates the real bottom-line cost including bank discounts, instant coupons, and cashback.',
      icon: '🏷️',
    },
    {
      step: '04',
      title: 'Instant Buy / Skip Verdict',
      desc: 'Our autonomous engine rates every deal: Steal Deal, Good Buy, or Wait for Lower Price.',
      icon: '⚡',
    },
  ];

  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-8">
      <div className="rounded-3xl border border-indigo-900/30 bg-gradient-to-br from-[#1E1B4B] via-[#2A2478] to-[#4338CA] p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/30 pb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-indigo-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Autonomous Deal Radar</span>
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Smart Deal Scanner
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-indigo-200 max-w-2xl">
              Protect your wallet against deceptive e-commerce sales. 4 layers of automated price verification.
            </p>
          </div>
          <div className="shrink-0">
            <span className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-300">
              100% Free Scanner
            </span>
          </div>
        </div>

        {/* 4 Feature Columns: Equal Height with min-w-0 */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((item) => (
            <div
              key={item.step}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-xs transition-all hover:bg-white/10 min-w-0"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[11px] font-black text-indigo-300">STEP {item.step}</span>
                </div>
                <h3 className="mt-3 text-sm sm:text-base font-bold text-white leading-snug">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs text-indigo-200/90 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
