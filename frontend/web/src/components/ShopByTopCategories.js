'use client';

import React from 'react';
import Link from 'next/link';

export default function ShopByTopCategories() {
  const categories = [
    {
      id: 'smartphones',
      title: 'Smartphones & Tech',
      icon: '📱',
      image: '/categories/electronics.jpg',
      tagline: 'Apple iPhone, Samsung, OnePlus, Redmi 5G',
      count: '240+ Deals',
      gradient: 'from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]',
      accentColor: 'text-[#2563eb]',
      borderColor: 'border-[#bfdbfe]',
      pills: [
        { label: 'Under ₹15,000', href: '/?category=electronics&q=smartphone' },
        { label: 'Under ₹25,000', href: '/?category=electronics&q=phone' },
        { label: '🔥 Flagship 5G', href: '/?category=electronics&q=5g' },
      ],
      href: '/?category=electronics&q=phone',
    },
    {
      id: 'fashion',
      title: 'Fashion & Sneakers',
      icon: '👗',
      image: '/categories/fashion.jpg',
      tagline: 'Trendy Sneakers, Handbags, Watches, Apparel',
      count: '500+ Deals',
      gradient: 'from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]',
      accentColor: 'text-[#e11d48]',
      borderColor: 'border-[#fecdd3]',
      pills: [
        { label: 'Min 60% Off', href: '/?category=fashion' },
        { label: 'Under ₹499 Store', href: '/?category=fashion&q=tshirt' },
        { label: '👟 Top Sneakers', href: '/?category=fashion&q=shoes' },
      ],
      href: '/?category=fashion',
    },
    {
      id: 'kitchen',
      title: 'Home & Kitchen',
      icon: '🍳',
      image: '/categories/home.jpg',
      tagline: 'Air Fryers, Espresso Machines, Robot Vacuums',
      count: '210+ Deals',
      gradient: 'from-[#fefce8] via-[#fef08a] to-[#fde047]',
      accentColor: 'text-[#ca8a04]',
      borderColor: 'border-[#fef08a]',
      pills: [
        { label: 'Air Fryers & Ovens', href: '/?category=home&q=fryer' },
        { label: 'Under ₹999 Kitchen', href: '/?category=home' },
        { label: 'Water Purifiers', href: '/?category=home&q=purifier' },
      ],
      href: '/?category=home',
    },
    {
      id: 'beauty',
      title: 'Beauty & Skincare',
      icon: '💄',
      image: '/categories/beauty.jpg',
      tagline: 'Glow Serums, Matte Lipsticks, Perfumes',
      count: '175+ Deals',
      gradient: 'from-[#fdf2f8] via-[#fce7f3] to-[#fbcfe8]',
      accentColor: 'text-[#db2777]',
      borderColor: 'border-[#fbcfe8]',
      pills: [
        { label: 'Under ₹399', href: '/?category=beauty' },
        { label: '🧴 Skincare Combos', href: '/?category=beauty&q=serum' },
        { label: 'Perfumes & Deos', href: '/?category=beauty&q=perfume' },
      ],
      href: '/?category=beauty',
    },
  ];

  return (
    <section className="my-10">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-brand">
            Curated Collections
          </span>
          <h2 className="text-xl font-black tracking-tight text-[#0f172a] sm:text-2xl">
            Shop By Top Categories
          </h2>
          <p className="text-xs text-[#64748b]">
            Browse India&apos;s lowest prices and active price drops by product category
          </p>
        </div>

        <Link
          href="/categories"
          className="inline-flex items-center gap-1 text-xs font-black text-[#4f46e5] hover:underline sm:text-sm"
        >
          View All Categories →
        </Link>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border ${c.borderColor} bg-gradient-to-br ${c.gradient} p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}
          >
            <div>
              {/* 3D Image Banner */}
              <Link href={c.href} className="relative mb-3 block overflow-hidden rounded-2xl border-2 border-white/80 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image}
                  alt={c.title}
                  className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-black text-white backdrop-blur-md">
                  {c.count}
                </div>
              </Link>

              {/* Title & Description */}
              <Link href={c.href}>
                <h3 className="text-sm font-black text-[#0f172a] group-hover:text-[#4f46e5] transition-colors">
                  {c.title}
                </h3>
              </Link>
              <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">{c.tagline}</p>
            </div>

            {/* Quick Price Range Filter Chips */}
            <div className="mt-3 border-t border-black/5 pt-2.5">
              <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#64748b]">
                Popular Ranges:
              </span>
              <div className="flex flex-wrap gap-1">
                {c.pills.map((pill, pi) => (
                  <Link
                    key={pi}
                    href={pill.href}
                    className="rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#0f172a] shadow-2xs hover:bg-white hover:text-brand transition-colors"
                  >
                    {pill.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
