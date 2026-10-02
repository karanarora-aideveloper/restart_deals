'use client';

import React from 'react';

export default function FeatureHighlights() {
  const features = [
    {
      icon: '🛡️',
      title: 'Fake Sale Detection',
      description: 'Sellers often double MRP right before big sales. Our AI compares real historical prices to tell you if a discount is genuine or fake.',
      badge: 'AI Powered',
      borderColor: 'border-[#bbf7d0]',
      bgColor: 'bg-[#f0fdf4]',
      badgeColor: 'text-[#16a34a]',
    },
    {
      icon: '📊',
      title: '3-Month Price Graph',
      description: 'Visualize every price change across Amazon, Flipkart, and Myntra. See all-time low records and know the exact right time to buy.',
      badge: '100% Accurate',
      borderColor: 'border-[#bfdbfe]',
      bgColor: 'bg-[#eff6ff]',
      badgeColor: 'text-[#2563eb]',
    },
    {
      icon: '🔔',
      title: 'Instant Price Alerts',
      description: 'Set your dream price on any product. When the price crashes, we instantly alert you via WhatsApp, Telegram, or Email.',
      badge: 'Free Forever',
      borderColor: 'border-[#fed7aa]',
      bgColor: 'bg-[#fffaf5]',
      badgeColor: 'text-[#ea580c]',
    },
    {
      icon: '🏷️',
      title: 'Verified Coupons',
      description: 'Never search for discount codes again. Get verified promo codes, bank cashback offers, and lightning deal coupons in one place.',
      badge: 'Auto Updated',
      borderColor: 'border-[#fbcfe8]',
      bgColor: 'bg-[#fdf2f8]',
      badgeColor: 'text-[#db2777]',
    },
  ];

  return (
    <section className="my-10 rounded-3xl border border-[#e2e8f0] bg-white p-6 sm:p-8 shadow-xs">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#fed7aa] bg-[#fffaf5] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#ea580c]">
          <span>⚡</span> Superior Shopping Intelligence
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#0f172a] sm:text-3xl">
          Why Over 100,000+ Shoppers Trust ShoppersDeals
        </h2>
        <p className="mt-1.5 text-xs text-[#64748b] sm:text-sm">
          Everything you need to make confident, money-saving purchasing decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <div
            key={i}
            className={`flex flex-col justify-between rounded-2xl border ${f.borderColor} ${f.bgColor} p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md`}
          >
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-2xl shadow-2xs">
                  {f.icon}
                </span>
                <span className={`rounded-md bg-white px-2 py-0.5 text-[10px] font-black shadow-2xs ${f.badgeColor}`}>
                  {f.badge}
                </span>
              </div>
              <h3 className="text-sm font-black text-[#0f172a]">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
