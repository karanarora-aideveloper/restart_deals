'use client';

import React from 'react';
import Link from 'next/link';

export default function V3CompareSection() {
  const cards = [
    {
      id: 'grocery',
      title: 'Grocery Compare',
      subtitle: 'Blinkit vs Zepto vs Instamart',
      href: '/compare?cat=grocery',
      bg: 'bg-[#FFF3E4]',
      hoverBorder: 'hover:border-amber-300',
      badgeColor: 'bg-amber-600',
      icon: (
        <svg className="w-10 h-10 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      id: 'flights',
      title: 'Flight Compare',
      subtitle: 'Lowest airfares across portals',
      href: '/compare?cat=flights',
      bg: 'bg-[#EFEFFF]',
      hoverBorder: 'hover:border-indigo-300',
      badgeColor: 'bg-[#5855E5]',
      icon: (
        <svg className="w-10 h-10 text-indigo-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      ),
    },
    {
      id: 'hotels',
      title: 'Hotel Compare',
      subtitle: 'Agoda, Booking.com & MMT',
      href: '/compare?cat=hotels',
      bg: 'bg-[#F2EFFF]',
      hoverBorder: 'hover:border-purple-300',
      badgeColor: 'bg-purple-600',
      icon: (
        <svg className="w-10 h-10 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 21h18M3 7v14M21 7v14M6 11h2M10 11h2M14 11h2M6 15h2M10 15h2M14 15h2M10 3h4v4h-4z" />
        </svg>
      ),
    },
    {
      id: 'mobiles',
      title: 'Mobiles & Tech',
      subtitle: 'Amazon vs Flipkart prices',
      href: '/best/mobiles',
      bg: 'bg-[#E8F8F0]',
      hoverBorder: 'hover:border-emerald-300',
      badgeColor: 'bg-emerald-600',
      icon: (
        <svg className="w-10 h-10 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      id: 'lens',
      title: 'Spend Lens',
      subtitle: 'AI Price Tracker & Savings',
      href: '/product-lens',
      bg: 'bg-[#FDECEC]',
      hoverBorder: 'hover:border-rose-300',
      badgeColor: 'bg-rose-600',
      icon: (
        <svg className="w-10 h-10 text-rose-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 mt-2 mb-8">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-sm">
        {/* Buyhatke Top Banner Strip */}
        <div className="flex justify-center -mt-4 sm:-mt-6 mb-5">
          <p className="inline-flex text-center text-xs font-semibold text-[#312F80] bg-[#EFEFFF] rounded-b-2xl px-5 py-1.5 shadow-2xs">
            Compare prices across flights, grocery, cabs &amp; more. Choose the best option &amp; save instantly.
          </p>
        </div>

        <div className="flex items-stretch gap-6">
          {/* Left Vertical Category Labels Stack (Desktop Only) */}
          <div className="hidden lg:flex flex-col justify-center gap-1.5 w-[220px] shrink-0 whitespace-nowrap pl-2">
            <p className="text-sm font-semibold text-slate-400">Compare Grocery</p>
            <p className="text-base font-bold text-indigo-900">Compare Flights</p>
            <p className="text-xl font-black text-[#5855E5] scale-105 transform origin-left">
              Compare Everything ⚡
            </p>
            <p className="text-base font-bold text-indigo-900">Compare Hotels</p>
            <p className="text-sm font-semibold text-slate-400">Compare Tech &amp; Cabs</p>
          </div>

          {/* Right 5-Card Grid */}
          <div className="grid flex-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
            {cards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className={`group flex flex-col justify-between gap-3 rounded-2xl p-3.5 border border-slate-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${card.bg} ${card.hoverBorder}`}
              >
                <div>{card.icon}</div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    {card.title}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                    {card.subtitle}
                  </p>
                </div>
                <div className="flex justify-end">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-bold transition-transform group-hover:translate-x-0.5 ${card.badgeColor}`}>
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
