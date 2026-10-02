'use client';

import React from 'react';
import Link from 'next/link';

const V3_CATEGORIES = [
  {
    id: 'electronics',
    name: 'Electronics & Mobiles',
    shortName: 'Mobiles & Tech',
    image: '/categories/electronics.jpg',
    href: '/best/mobiles',
    badge: 'Up to 75% Off',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    count: '350+ Deals',
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    shortName: 'Fashion',
    image: '/categories/fashion.jpg',
    href: '/categories/fashion',
    badge: '50-80% Off',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    count: '520+ Deals',
  },
  {
    id: 'beauty',
    name: 'Beauty & Skincare',
    shortName: 'Beauty & Care',
    image: '/categories/beauty.jpg',
    href: '/best/skincare',
    badge: 'Flat 40% Off',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
    count: '180+ Deals',
  },
  {
    id: 'home',
    name: 'Home & Kitchen',
    shortName: 'Home & Kitchen',
    image: '/categories/home.jpg',
    href: '/categories/home',
    badge: 'Min 50% Off',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    count: '210+ Deals',
  },
  {
    id: 'fitness',
    name: 'Fitness & Sports',
    shortName: 'Gym & Fitness',
    image: '/categories/fitness.jpg',
    href: '/best/gym-equipment',
    badge: 'Whey & Gear',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    count: '110+ Deals',
  },
  {
    id: 'laptops',
    name: 'Laptops & Computers',
    shortName: 'Laptops',
    image: '/categories/laptops.jpg',
    href: '/best/laptops',
    badge: 'Intel & Mac',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    count: '140+ Deals',
  },
  {
    id: 'loot',
    name: 'Lightning Loot Deals',
    shortName: 'Flash Loot',
    image: '/categories/loot.jpg',
    href: '/hot',
    badge: 'Under ₹99',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    count: '400+ Steals',
  },
  {
    id: 'grocery',
    name: 'Grocery & Essentials',
    shortName: '10-Min Grocery',
    image: '/categories/grocery.jpg',
    href: '/compare?cat=grocery',
    badge: 'Lowest Price',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    count: 'Blinkit vs Zepto',
  },
];

export default function V3CategoriesRail() {
  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-6">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 text-sm font-black">
              ✨
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              Explore by Top Categories
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>

        {/* 8-Item Category Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {V3_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className="group flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-md"
            >
              {/* 3D Illustration Container */}
              <div className="relative mb-2.5 h-16 w-16 sm:h-20 sm:w-20 md:h-22 md:w-22 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-transform duration-300 group-hover:scale-105">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
              </div>

              {/* Title */}
              <span className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {cat.shortName}
              </span>

              {/* Badge */}
              <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat.badgeColor}`}>
                {cat.badge}
              </span>

              {/* Deals count */}
              <span className="mt-1 text-[10px] font-semibold text-slate-400">
                {cat.count}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
