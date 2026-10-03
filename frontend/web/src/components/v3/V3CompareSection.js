'use client';

import React from 'react';
import Link from 'next/link';

export default function V3CompareSection() {
  const cards = [
    {
      id: 'grocery',
      title: 'Grocery & Essentials',
      subtitle: 'Blinkit • Zepto • Instamart',
      href: '/compare?cat=grocery',
      bg: 'bg-[#FFF3E4]/80',
      hoverBorder: 'hover:border-amber-300',
      badgeColor: 'bg-amber-600',
      icon: (
        <svg className="w-8 h-8 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      id: 'mobiles',
      title: 'Mobiles & Tablets',
      subtitle: 'Amazon vs Flipkart Prices',
      href: '/best/mobiles',
      bg: 'bg-[#E8F8F0]/80',
      hoverBorder: 'hover:border-emerald-300',
      badgeColor: 'bg-emerald-600',
      icon: (
        <svg className="w-8 h-8 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      id: 'laptops',
      title: 'Laptops & Gadgets',
      subtitle: 'MacBook • ASUS • HP Deals',
      href: '/best/laptops',
      bg: 'bg-[#EFEFFF]/80',
      hoverBorder: 'hover:border-indigo-300',
      badgeColor: 'bg-[#5855E5]',
      icon: (
        <svg className="w-8 h-8 text-indigo-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: 'fashion',
      title: 'Fashion & Apparel',
      subtitle: 'Myntra • Ajio • Meesho',
      href: '/categories/fashion',
      bg: 'bg-[#FDECEC]/80',
      hoverBorder: 'hover:border-rose-300',
      badgeColor: 'bg-rose-600',
      icon: (
        <svg className="w-8 h-8 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
        </svg>
      ),
    },
    {
      id: 'beauty',
      title: 'Beauty & Skincare',
      subtitle: 'Nykaa • Tira • Purplle',
      href: '/categories/beauty',
      bg: 'bg-[#FDF2F8]/90',
      hoverBorder: 'hover:border-pink-300',
      badgeColor: 'bg-pink-600',
      icon: (
        <svg className="w-8 h-8 text-pink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
    {
      id: 'flights',
      title: 'Flights & Travel',
      subtitle: 'Lowest Airfare Across OTAs',
      href: '/compare?cat=flights',
      bg: 'bg-[#F2EFFF]/80',
      hoverBorder: 'hover:border-purple-300',
      badgeColor: 'bg-purple-600',
      icon: (
        <svg className="w-8 h-8 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        {/* Buyhatke Banner Pill */}
        <div className="flex justify-center -mt-4 sm:-mt-5 mb-5">
          <p className="inline-flex items-center gap-1.5 text-center text-xs font-semibold text-[#312F80] bg-[#EFEFFF] border border-indigo-100 rounded-b-xl px-5 py-1 shadow-2xs">
            <span>✨ Compare prices across flights, grocery, tech &amp; lifestyle. Pick the lowest price &amp; save.</span>
          </p>
        </div>

        {/* 6-Card Symmetric Responsive Grid: 6 cols on XL, 3 cols on MD, 2 cols on Mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`group flex flex-col justify-between rounded-xl p-3 border border-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${card.bg} ${card.hoverBorder}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-white/80 shadow-2xs">
                  {card.icon}
                </div>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold transition-transform group-hover:translate-x-0.5 ${card.badgeColor}`}>
                  →
                </span>
              </div>

              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 leading-snug truncate" title={card.title}>
                  {card.title}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5" title={card.subtitle}>
                  {card.subtitle}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
