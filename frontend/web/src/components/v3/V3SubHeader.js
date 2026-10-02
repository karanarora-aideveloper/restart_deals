'use client';

import React from 'react';
import Link from 'next/link';

export default function V3SubHeader({ activeTab = 'deals' }) {
  const tabs = [
    {
      id: 'deals',
      label: 'Deals',
      href: '/#deals',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
      activeBg: 'bg-[#EFEFFF] text-[#5855E5]',
      hoverBg: 'hover:bg-[#EFEFFF] hover:text-[#5855E5]',
    },
    {
      id: 'compare',
      label: 'Compare',
      href: '/compare',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      ),
      activeBg: 'bg-[#FFF7D9] text-[#B45309]',
      hoverBg: 'hover:bg-[#FFF7D9] hover:text-[#B45309]',
    },
    {
      id: 'credit-cards',
      label: 'Credit Cards',
      href: '/credit-cards',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
      activeBg: 'bg-[#EFF6FF] text-[#1D4ED8]',
      hoverBg: 'hover:bg-[#EFF6FF] hover:text-[#1D4ED8]',
    },
    {
      id: 'stores',
      label: 'Top Stores',
      href: '/#stores',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      activeBg: 'bg-[#F0FDF4] text-[#15803D]',
      hoverBg: 'hover:bg-[#F0FDF4] hover:text-[#15803D]',
    },
    {
      id: 'lens',
      label: 'Spend Lens',
      href: '/product-lens',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      ),
      activeBg: 'bg-[#E8F8F0] text-[#059669]',
      hoverBg: 'hover:bg-[#E8F8F0] hover:text-[#059669]',
    },
    {
      id: 'alerts',
      label: 'Alerts',
      href: '/profile/alerts',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      activeBg: 'bg-[#FDECEC] text-[#DC2626]',
      hoverBg: 'hover:bg-[#FDECEC] hover:text-[#DC2626]',
    },
    {
      id: 'wishlist',
      label: 'OneList',
      href: '/wishlist',
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      ),
      activeBg: 'bg-[#EFEFFF] text-[#5855E5]',
      hoverBg: 'hover:bg-[#EFEFFF] hover:text-[#5855E5]',
    },
  ];

  return (
    <div className="w-full border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1720px] 2xl:max-w-[1840px] items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 py-2">
        {/* Nav tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-hide py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive ? tab.activeBg : 'bg-slate-50 text-slate-600 ' + tab.hoverBg
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side live status indicator */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            100K+ Stores Monitored
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-indigo-600 font-bold">12H Sync Cadence</span>
        </div>
      </div>
    </div>
  );
}
