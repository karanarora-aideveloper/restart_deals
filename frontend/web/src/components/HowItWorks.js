'use client';

import React from 'react';

export default function HowItWorks() {
  const steps = [
    {
      step: '01',
      emoji: '🔗',
      title: 'Paste Any Store Link or Search',
      description: 'Copy any product URL from Amazon, Flipkart, Myntra, Nykaa, or Ajio and paste it into our search bar.',
      highlight: 'Works across 100+ stores',
    },
    {
      step: '02',
      emoji: '📊',
      title: 'Check 90-Day Price History',
      description: 'See the highest, lowest, and average price history to know if a sale is genuinely discounted or an inflated MRP trick.',
      highlight: 'Instant AI Verdict',
    },
    {
      step: '03',
      emoji: '🔔',
      title: 'Get Free Price Drop Alerts',
      description: 'Set your target price. Our 24/7 trackers will ping you on WhatsApp or Email the moment the price falls.',
      highlight: 'Real-time Notifications',
    },
  ];

  return (
    <section className="my-10 rounded-3xl border border-[#e2e8f0] bg-gradient-to-b from-[#f8fafc] to-white p-6 sm:p-10 shadow-xs">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#15803d]">
          <span>💡</span> Smart Shopping Simplified
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#0f172a] sm:text-3xl">
          How ShoppersDeals Saves You Money
        </h2>
        <p className="mt-1.5 text-xs text-[#64748b] sm:text-sm">
          Never overpay during flash sales again with India&apos;s most accurate price tracking assistant.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.step}
            className="relative flex flex-col justify-between rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ed] text-2xl">
                  {s.emoji}
                </span>
                <span className="text-2xl font-black text-[#e2e8f0]">{s.step}</span>
              </div>
              <h3 className="text-base font-extrabold text-[#0f172a]">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#64748b]">{s.description}</p>
            </div>
            <div className="mt-5 border-t border-[#f1f5f9] pt-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand">
                <span>✓</span> {s.highlight}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
