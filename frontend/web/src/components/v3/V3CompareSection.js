'use client';

import React from 'react';
import Link from 'next/link';

export default function V3CompareSection() {
  const cards = [
    {
      id: 'mobiles',
      title: 'Mobiles & Tablets',
      subtitle: 'Amazon vs Flipkart',
      href: '/best/mobiles',
      badge: 'Save ₹3,000+',
      actionText: 'Compare 5G Deals',
      gradient: 'from-white to-emerald-50/40',
      hoverBorder: 'hover:border-emerald-300',
      iconBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100/80 text-emerald-800',
      actionColor: 'text-emerald-700',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      id: 'laptops',
      title: 'Laptops & Gadgets',
      subtitle: 'MacBook • ASUS • HP',
      href: '/best/laptops',
      badge: 'Card Offers',
      actionText: 'Compare Specs',
      gradient: 'from-white to-indigo-50/40',
      hoverBorder: 'hover:border-indigo-300',
      iconBg: 'bg-indigo-600',
      badgeBg: 'bg-indigo-100/80 text-indigo-800',
      actionColor: 'text-indigo-600',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: 'televisions',
      title: 'Smart TVs & Audio',
      subtitle: 'Sony • Samsung • LG',
      href: '/best/televisions',
      badge: 'Up to 50% Off',
      actionText: 'Compare 4K TVs',
      gradient: 'from-white to-sky-50/40',
      hoverBorder: 'hover:border-sky-300',
      iconBg: 'bg-sky-500',
      badgeBg: 'bg-sky-100/80 text-sky-800',
      actionColor: 'text-sky-600',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      ),
    },
    {
      id: 'fashion',
      title: 'Fashion & Apparel',
      subtitle: 'Myntra • Ajio • Meesho',
      href: '/categories/fashion',
      badge: '60–80% Off',
      actionText: 'Compare Trends',
      gradient: 'from-white to-rose-50/40',
      hoverBorder: 'hover:border-rose-300',
      iconBg: 'bg-rose-500',
      badgeBg: 'bg-rose-100/80 text-rose-800',
      actionColor: 'text-rose-600',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
        </svg>
      ),
    },
    {
      id: 'beauty',
      title: 'Beauty & Skincare',
      subtitle: 'Nykaa • Tira • Amazon',
      href: '/categories/beauty',
      badge: 'Shade Deals',
      actionText: 'Compare Shades',
      gradient: 'from-white to-pink-50/40',
      hoverBorder: 'hover:border-pink-300',
      iconBg: 'bg-pink-500',
      badgeBg: 'bg-pink-100/80 text-pink-800',
      actionColor: 'text-pink-600',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      id: 'grocery',
      title: 'Grocery & Pantry',
      subtitle: 'Amazon Fresh • Flipkart',
      href: '/categories/grocery',
      badge: 'Pantry Steals',
      actionText: 'Explore Pantry',
      gradient: 'from-white to-amber-50/40',
      hoverBorder: 'hover:border-amber-300',
      iconBg: 'bg-amber-500',
      badgeBg: 'bg-amber-100/80 text-amber-800',
      actionColor: 'text-amber-700',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-4">
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
        {/* Section Header Strip */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-sm sm:text-base font-black shadow-2xs">
              ⚡
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Multi-Store Price Comparison Matrix
                <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-emerald-700">
                  Live Arbitrage
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Compare verified prices across top Indian platforms — pick the lowest store before buying.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50/80 border border-indigo-100 rounded-full px-3 py-1">
            <span>✨</span>
            <span>90-Day Real Price History</span>
          </div>
        </div>

        {/* 6-Card Symmetric Responsive Grid: 6 cols on XL, 3 cols on MD, 2 cols on Mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-b ${card.gradient} p-3 sm:p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 ${card.hoverBorder} hover:shadow-md cursor-pointer`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${card.iconBg} shadow-xs`}>
                    {card.icon}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[9.5px] font-extrabold ${card.badgeBg}`}>
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 leading-snug truncate group-hover:text-indigo-600 transition-colors" title={card.title}>
                  {card.title}
                </h3>
                <p className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500 truncate mt-0.5" title={card.subtitle}>
                  {card.subtitle}
                </p>
              </div>

              <div className={`mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[10.5px] font-bold ${card.actionColor}`}>
                <span>{card.actionText}</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
