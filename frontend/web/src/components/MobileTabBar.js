'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', id: 'deals', label: 'Deals', match: (p) => p === '/' || p.startsWith('/deal/') },
  { href: '/hot', id: 'hot', label: 'Hot' },
  { href: '/products', id: 'products', label: 'Track' },
  { href: '/saved', id: 'saved', label: 'Saved', match: (p) => p === '/saved' },
  { href: '/profile', id: 'profile', label: 'Account' },
];

const ICONS = {
  deals: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FF6B00' : 'none'} stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.5 3H4a1 1 0 0 0-1 1v5.5a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill={active ? '#FF6B00' : '#b0b0b0'} stroke="none" />
    </svg>
  ),
  hot: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FF6B00' : 'none'} stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-2.5 2 1 3.5 3.5 3.5 6a5.5 5.5 0 1 1-11 0C6.5 9 9 6 12 2Z" />
    </svg>
  ),
  products: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  ),
  categories: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FF6B00' : 'none'} stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  saved: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FF6B00' : 'none'} stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  ),
  profile: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#FF6B00' : 'none'} stroke={active ? '#FF6B00' : '#b0b0b0'} strokeWidth="2">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
};

/**
 * Mobile-only bottom nav — the web counterpart of the native app's BottomTabBar. Real
 * <Link> elements (not JS-only tab state) so each destination is a crawlable, bookmarkable
 * URL. Hidden at md+ where the desktop header nav takes over.
 */
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eee] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-start justify-around px-2 pb-1 pt-2.5">
        {TABS.map((tab) => {
          const isActive = tab.match ? tab.match(pathname) : pathname === tab.href;
          return (
            <Link key={tab.id} href={tab.href} className="relative flex flex-1 flex-col items-center py-1">
              <span className="mb-[3px]">{ICONS[tab.id](isActive)}</span>
              <span className={`text-[10px] tracking-[0.1px] ${isActive ? 'font-extrabold text-brand' : 'font-medium text-[#b0b0b0]'}`}>
                {tab.label}
              </span>
              {isActive && <span className="absolute -top-2.5 left-1/4 right-1/4 h-[2px] rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
