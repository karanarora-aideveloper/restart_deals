'use client';

import React from 'react';
import Link from 'next/link';
import {
  AmazonLogo,
  FlipkartLogo,
  MyntraLogo,
  ShopsyLogo,
  NykaaLogo,
  AjioLogo,
} from '@/components/BrandAndStoreLogos';

export default function TopStoresGrid() {
  const stores = [
    {
      id: 'amazon',
      name: 'Amazon India',
      tagline: 'Great Indian Festival & Lightning Deals',
      badge: '🔥 Up to 80% Off',
      bgColor: 'from-[#fff8eb] to-[#fff3db]',
      borderColor: 'border-[#fed7aa]',
      textColor: 'text-[#ea580c]',
      icon: <AmazonLogo className="h-4.5 w-auto object-contain" />,
      href: '/?merchant=amazon',
    },
    {
      id: 'flipkart',
      name: 'Flipkart',
      tagline: 'Big Billion Days & SuperCoin Drops',
      badge: '⚡ Extra Bank Discounts',
      bgColor: 'from-[#eff6ff] to-[#dbeafe]',
      borderColor: 'border-[#bfdbfe]',
      textColor: 'text-[#2563eb]',
      icon: <FlipkartLogo className="h-4.5 w-auto object-contain" />,
      href: '/?merchant=flipkart',
    },
    {
      id: 'myntra',
      name: 'Myntra',
      tagline: 'Fashion, Footwear & Designer Loot',
      badge: '👗 50-80% Off Brands',
      bgColor: 'from-[#fff1f2] to-[#ffe4e6]',
      borderColor: 'border-[#fecdd3]',
      textColor: 'text-[#e11d48]',
      icon: <MyntraLogo className="h-4.5 w-auto object-contain" />,
      href: '/?merchant=myntra',
    },
    {
      id: 'nykaa',
      name: 'Nykaa',
      tagline: 'Beauty, Skincare & Luxury Cosmetics',
      badge: '💄 Free Gifts & Combos',
      bgColor: 'from-[#fdf2f8] to-[#fce7f3]',
      borderColor: 'border-[#fbcfe8]',
      textColor: 'text-[#db2777]',
      icon: <NykaaLogo className="h-4.5 w-auto object-contain" />,
      href: '/?merchant=nykaa',
    },
    {
      id: 'ajio',
      name: 'Ajio',
      tagline: 'Trends, Sneakers & Premium Streetwear',
      badge: '🏷️ Flat ₹500 Off Coupons',
      bgColor: 'from-[#f0fdf4] to-[#dcfce7]',
      borderColor: 'border-[#bbf7d0]',
      textColor: 'text-[#16a34a]',
      icon: <AjioLogo className="h-4 w-auto object-contain" />,
      href: '/?merchant=ajio',
    },
    {
      id: 'shopsy',
      name: 'Shopsy',
      tagline: 'Budget Shopping & Under ₹99 Deals',
      badge: '💰 Lowest Price Guaranteed',
      bgColor: 'from-[#faf5ff] to-[#f3e8ff]',
      borderColor: 'border-[#e9d5ff]',
      textColor: 'text-[#9333ea]',
      icon: <ShopsyLogo className="h-4.5 w-auto" />,
      href: '/?merchant=shopsy',
    },
  ];

  return (
    <section className="my-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[#0f172a] sm:text-xl">Top Stores Tracked</h2>
          <p className="text-xs text-[#64748b]">Explore live price drops &amp; verified promo codes by store</p>
        </div>
        <Link href="/categories" className="text-xs font-bold text-brand hover:underline">
          View All Stores →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stores.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={`group relative flex flex-col justify-between rounded-2xl border ${s.borderColor} bg-gradient-to-b ${s.bgColor} p-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md min-w-0`}
            title={s.name}
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="flex h-10 w-full max-w-[125px] items-center justify-center rounded-xl bg-white px-2 py-1 shadow-2xs border border-white/70 overflow-hidden">
                  {s.icon}
                </span>
                <span className={`rounded-md bg-white/90 px-1.5 py-0.5 text-[9.5px] font-black ${s.textColor} shrink-0`}>
                  Live
                </span>
              </div>
              <p className="mt-2 text-[10.5px] leading-tight text-[#475569] font-medium min-h-[26px] line-clamp-2">
                {s.tagline}
              </p>
            </div>

            <div className="mt-3">
              <span className={`inline-block rounded-md bg-white px-2 py-1 text-[10px] font-black shadow-2xs ${s.textColor} truncate max-w-full`}>
                {s.badge}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
