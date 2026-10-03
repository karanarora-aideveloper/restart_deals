'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { useCompare } from '@/lib/useCompare';

export default function QuickCategoryRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { compareItems } = useCompare();
  const activeCategory = searchParams.get('category') || 'all';
  const countryParam = (searchParams.get('country') || '').toLowerCase();

  const getHref = (path) => {
    if (!countryParam || countryParam === 'in') return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}country=${countryParam}`;
  };

  const tabs = [
    {
      id: 'deals',
      label: 'Live Deals',
      icon: '🔥',
      href: getHref('/'),
      isActive: pathname === '/' && activeCategory === 'all',
      hoverColor: 'hover:text-[#ea580c]',
    },
    {
      id: 'hot',
      label: '50%+ Drops',
      icon: '⚡',
      href: getHref('/hot'),
      isActive: pathname === '/hot',
      hoverColor: 'hover:text-[#ea580c]',
    },
    {
      id: 'products',
      label: 'Price Tracker',
      icon: '📊',
      href: getHref('/products'),
      isActive: pathname === '/products',
      hoverColor: 'hover:text-[#7c3aed]',
    },
    {
      id: 'coupons',
      label: 'Coupons',
      icon: '🏷️',
      href: getHref('/coupons'),
      isActive: pathname === '/coupons',
      hoverColor: 'hover:text-[#f59e0b]',
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: '⚖️',
      href: getHref('/compare'),
      isActive: pathname === '/compare',
      hoverColor: 'hover:text-[#2563eb]',
      badge: compareItems?.length || 0,
    },
    {
      id: 'blog',
      label: 'Buying Guides',
      icon: '📖',
      href: getHref('/blog'),
      isActive: pathname.startsWith('/blog'),
      hoverColor: 'hover:text-[#059669]',
    },
    {
      id: 'electronics',
      label: 'Mobiles & Tech',
      icon: '📱',
      href: getHref('/?category=electronics'),
      isActive: activeCategory === 'electronics',
      hoverColor: 'hover:text-[#2563eb]',
    },
    {
      id: 'fashion',
      label: 'Fashion Loot',
      icon: '👗',
      href: getHref('/?category=fashion'),
      isActive: activeCategory === 'fashion',
      hoverColor: 'hover:text-[#e11d48]',
    },
    {
      id: 'home',
      label: 'Home & Kitchen',
      icon: '🏠',
      href: getHref('/?category=home'),
      isActive: activeCategory === 'home',
      hoverColor: 'hover:text-[#16a34a]',
    },
    {
      id: 'beauty',
      label: 'Beauty & Care',
      icon: '💄',
      href: getHref('/?category=beauty'),
      isActive: activeCategory === 'beauty',
      hoverColor: 'hover:text-[#db2777]',
    },
    {
      id: 'categories',
      label: 'All Categories',
      icon: '🗂️',
      href: getHref('/categories'),
      isActive: pathname === '/categories',
      hoverColor: 'hover:text-[#475569]',
    },
  ];

  return (
    <div className="w-full border-b border-[#f1f5f9] bg-white py-2 shadow-2xs">
      <div className="mx-auto flex w-full max-w-[1360px] 2xl:max-w-[1400px] items-center gap-2 overflow-x-auto px-4 md:px-6 scrollbar-none">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all duration-150 ${
              tab.isActive
                ? 'bg-brand text-white shadow-xs'
                : 'bg-[#f8fafc] text-[#475569] hover:bg-[#f1f5f9] ' + tab.hoverColor
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black text-white">
                {tab.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
