'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

export default function QuickCategoryRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category') || 'all';

  const tabs = [
    {
      id: 'deals',
      label: 'Live Deals',
      icon: '🔥',
      href: '/',
      isActive: pathname === '/' && activeCategory === 'all',
      hoverColor: 'hover:text-[#ea580c]',
    },
    {
      id: 'electronics',
      label: 'Mobiles & Tech',
      icon: '📱',
      href: '/?category=electronics',
      isActive: activeCategory === 'electronics',
      hoverColor: 'hover:text-[#2563eb]',
    },
    {
      id: 'fashion',
      label: 'Fashion Loot',
      icon: '👗',
      href: '/?category=fashion',
      isActive: activeCategory === 'fashion',
      hoverColor: 'hover:text-[#e11d48]',
    },
    {
      id: 'home',
      label: 'Home & Kitchen',
      icon: '🏠',
      href: '/?category=home',
      isActive: activeCategory === 'home',
      hoverColor: 'hover:text-[#16a34a]',
    },
    {
      id: 'beauty',
      label: 'Beauty & Care',
      icon: '💄',
      href: '/?category=beauty',
      isActive: activeCategory === 'beauty',
      hoverColor: 'hover:text-[#db2777]',
    },
    {
      id: 'hot',
      label: '50%+ Drops',
      icon: '⚡',
      href: '/hot',
      isActive: pathname === '/hot',
      hoverColor: 'hover:text-[#ea580c]',
    },
    {
      id: 'products',
      label: 'Price Tracker',
      icon: '📊',
      href: '/products',
      isActive: pathname === '/products',
      hoverColor: 'hover:text-[#7c3aed]',
    },
    {
      id: 'saved',
      label: 'Wishlist & Alerts',
      icon: '❤️',
      href: '/saved',
      isActive: pathname === '/saved',
      hoverColor: 'hover:text-[#e11d48]',
    },
  ];

  return (
    <div className="w-full border-b border-[#f1f5f9] bg-white py-2.5 shadow-2xs">
      <div className="mx-auto flex w-full max-w-[1720px] 2xl:max-w-[1840px] items-center gap-2 overflow-x-auto px-4 md:px-8 scrollbar-none">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all duration-150 ${
              tab.isActive
                ? 'bg-brand text-white shadow-xs'
                : 'bg-[#f8fafc] text-[#475569] hover:bg-[#f1f5f9] ' + tab.hoverColor
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
