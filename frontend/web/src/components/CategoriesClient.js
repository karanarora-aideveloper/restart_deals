'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  {
    id: 'electronics',
    name: 'Electronics & Mobiles',
    tagline: 'Smartphones, Laptops, Earbuds, Smartwatches, 4K TVs',
    emoji: '📱',
    image: '/categories/electronics.jpg',
    color: '#2563eb',
    gradient: 'from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]',
    borderColor: 'border-[#bfdbfe]',
    count: '350+ Deals',
    subcategories: [
      { name: 'Smartphones', href: '/best/mobiles' },
      { name: 'Laptops', href: '/best/laptops' },
      { name: 'TWS Earbuds', href: '/best/earbuds-headphones' },
      { name: 'Smartwatches', href: '/best/smartwatches' },
      { name: '4K Smart TVs', href: '/best/televisions' },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    tagline: 'T-Shirts, Dresses, Jeans, Ethnic Wear, Sneakers, Watches',
    emoji: '👗',
    image: '/categories/fashion.jpg',
    color: '#e11d48',
    gradient: 'from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]',
    borderColor: 'border-[#fecdd3]',
    count: '520+ Deals',
    subcategories: [
      { name: 'Running Shoes', href: '/best/running-shoes' },
      { name: "Men's T-Shirts", href: '/best/mens-tshirts' },
      { name: "Women's Footwear", href: '/best/women-footwear' },
      { name: 'Watches', href: '/best/watches' },
      { name: 'Fashion Hub', href: '/categories/fashion' },
    ],
  },
  {
    id: 'home',
    name: 'Home & Kitchen',
    tagline: 'Air Fryers, Cookware, Robot Vacuums, Home Decor',
    emoji: '🍳',
    image: '/categories/home.jpg',
    color: '#ca8a04',
    gradient: 'from-[#fefce8] via-[#fef08a] to-[#fde047]',
    borderColor: 'border-[#fef08a]',
    count: '210+ Deals',
    subcategories: [
      { name: 'Kitchen & Dining', href: '/best/kitchen-dining' },
      { name: 'Home Decor', href: '/best/home-decor' },
      { name: 'Air Fryers Guide', href: '/blog/best-air-fryers-india-digital-rapid-air-2026' },
      { name: 'Washing Machines Guide', href: '/blog/best-washing-machines-india-front-vs-top-load-2026' },
      { name: 'Induction Stoves', href: '/blog/best-induction-cooktops-india-surge-protection-2026' },
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    tagline: 'Skincare Serums, Makeup, Hair Care, Fragrances',
    emoji: '💄',
    image: '/categories/beauty.jpg',
    color: '#db2777',
    gradient: 'from-[#fdf2f8] via-[#fce7f3] to-[#fbcfe8]',
    borderColor: 'border-[#fbcfe8]',
    count: '180+ Deals',
    subcategories: [
      { name: 'Skincare', href: '/best/skincare' },
      { name: 'Bath & Body', href: '/best/bath-body' },
      { name: 'Hair Care', href: '/best/haircare' },
      { name: 'Makeup & Cosmetics', href: '/best/makeup' },
    ],
  },
  {
    id: 'fitness',
    name: 'Fitness & Sports',
    tagline: 'Supplements, Dumbbells, Yoga Mats, Cycles, Sportswear',
    emoji: '🏋️',
    image: '/categories/fitness.jpg',
    color: '#16a34a',
    gradient: 'from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0]',
    borderColor: 'border-[#bbf7d0]',
    count: '110+ Deals',
    subcategories: [
      { name: 'Whey & Supplements', href: '/best/supplements' },
      { name: 'Gym Equipment', href: '/best/gym-equipment' },
      { name: 'Fitness Gear', href: '/best/fitness-gear' },
      { name: 'Smart Bands', href: '/best/smartwatches' },
    ],
  },
  {
    id: 'appliances',
    name: 'Large & Kitchen Appliances',
    tagline: 'Refrigerators, Washing Machines, Inverter ACs, Water Purifiers, OTG',
    emoji: '🧊',
    image: null,
    color: '#0891b2',
    gradient: 'from-[#ecfeff] via-[#cffafe] to-[#a5f3fc]',
    borderColor: 'border-[#a5f3fc]',
    count: '240+ Deals',
    subcategories: [
      { name: 'Refrigerators', href: '/best/refrigerators' },
      { name: 'Washing Machines', href: '/best/washing-machines' },
      { name: 'Air Conditioners', href: '/best/air-conditioners' },
      { name: 'Water Purifiers', href: '/best/water-purifiers' },
      { name: 'Microwaves & OTG', href: '/best/microwaves' },
    ],
  },
  {
    id: 'grocery',
    name: '10-Minute Grocery & Daily Staples',
    tagline: 'Milk, Atta, Cooking Oil, Dairy & Snacks compared live across Blinkit & Instamart',
    emoji: '⚡',
    image: null,
    color: '#16a34a',
    gradient: 'from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0]',
    borderColor: 'border-[#bbf7d0]',
    count: 'Live Comparison',
    subcategories: [
      { name: 'Milk & Dairy', href: '/compare/grocery?category=dairy' },
      { name: 'Atta & Cooking Staples', href: '/compare/grocery?category=staples' },
      { name: 'Snacks & Instant Food', href: '/compare/grocery?category=instant' },
      { name: '10-Minute Grocery Compare', href: '/compare/grocery' },
    ],
  },
  {
    id: 'baby-kids',
    name: 'Baby & Kids Essentials',
    tagline: 'Diapers, Baby Care, Toys, Strollers, Kids Apparel',
    emoji: '🍼',
    image: null,
    color: '#f59e0b',
    gradient: 'from-[#fffbeb] via-[#fef3c7] to-[#fde68a]',
    borderColor: 'border-[#fde68a]',
    count: '95+ Deals',
    subcategories: [
      { name: 'Baby Care & Diapers', href: '/categories/baby-kids' },
      { name: 'Toys & Games', href: '/categories/baby-kids?q=toys' },
      { name: 'Kids Fashion', href: '/categories/baby-kids?q=clothing' },
    ],
  },
  {
    id: 'books-stationery',
    name: 'Books & Stationery',
    tagline: 'Fiction, Non-Fiction, Competitive Exams, Kindle & Office Essentials',
    emoji: '📚',
    image: null,
    color: '#78716c',
    gradient: 'from-[#fafaf9] via-[#f5f5f4] to-[#e7e5e4]',
    borderColor: 'border-[#e7e5e4]',
    count: '80+ Deals',
    subcategories: [
      { name: 'Best Sellers', href: '/categories/books-stationery' },
      { name: 'Self Help & Finance', href: '/categories/books-stationery?q=finance' },
      { name: 'Exam Prep', href: '/categories/books-stationery?q=exam' },
    ],
  },
];

const CURATED_COLLECTIONS = [
  {
    title: '⚡ Under ₹499 Loot Deals',
    subtitle: 'High value budget finds from Amazon & Flipkart',
    emoji: '💰',
    color: 'from-[#fff8eb] to-[#fff3db]',
    borderColor: 'border-[#fed7aa]',
    textColor: 'text-[#ea580c]',
    href: '/hot',
  },
  {
    title: '📱 5G Phones Under ₹15,000',
    subtitle: 'Realme, Redmi, Samsung & Poco discounts',
    emoji: '📱',
    color: 'from-[#eff6ff] to-[#dbeafe]',
    borderColor: 'border-[#bfdbfe]',
    textColor: 'text-[#2563eb]',
    href: '/blog/best-phones-under-15000-india-2026',
  },
  {
    title: '🎧 Noise Cancelling Audio Loot',
    subtitle: 'Sony, JBL, boAt & OnePlus at 90-day lowest',
    emoji: '🎧',
    color: 'from-[#faf5ff] to-[#f3e8ff]',
    borderColor: 'border-[#e9d5ff]',
    textColor: 'text-[#9333ea]',
    href: '/best/earbuds-headphones',
  },
  {
    title: '👗 Branded Footwear 60-80% Off',
    subtitle: 'Nike, Puma, Adidas, Red Tape & Sparx',
    emoji: '👟',
    color: 'from-[#fff1f2] to-[#ffe4e6]',
    borderColor: 'border-[#fecdd3]',
    textColor: 'text-[#e11d48]',
    href: '/best/running-shoes',
  },
];

const CHANNELS = [
  {
    id: 'channel_1',
    name: 'Amazon Hot Deals India',
    platform: 'Amazon Prime & Lightning',
    subscribers: '1.2 Lakh+',
    emoji: '🛍️',
    color: '#ea580c',
    speed: '< 3s Alert Speed',
  },
  {
    id: 'channel_2',
    name: 'Flipkart Big Savings Feed',
    platform: 'Flipkart & SuperCoins',
    subscribers: '98K+',
    emoji: '⚡',
    color: '#2563eb',
    speed: '< 5s Alert Speed',
  },
  {
    id: 'channel_3',
    name: 'Tech & Gadgets Drops',
    platform: 'Laptops, Earbuds & Audio',
    subscribers: '65K+',
    emoji: '💻',
    color: '#7c3aed',
    speed: '< 2s Alert Speed',
  },
  {
    id: 'channel_4',
    name: 'Fashion & Sneakers Alert',
    platform: 'Myntra & AJIO Loot',
    subscribers: '45K+',
    emoji: '👗',
    color: '#e11d48',
    speed: '< 4s Alert Speed',
  },
];

export default function CategoriesClient() {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCategories = CATEGORIES.filter((c) =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.tagline.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.subcategories.some((s) => s.name.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-20 md:px-8">
      {/* 1. Hero Header Banner */}
      <div className="mb-8 rounded-3xl border border-[#cbd5e1] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-6 sm:p-10 text-white shadow-xl">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#fbbf24] backdrop-blur-xs">
            <span>✨</span> Explore 100,000+ Verified Deals
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
            Shop By Categories &amp; Curated Collections
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#94a3b8] sm:text-sm">
            Discover India&apos;s lowest historical prices, real-time loot deals, and AI-monitored price drop feeds across Amazon, Flipkart, Myntra, and Nykaa.
          </p>

          {/* In-page Category Search */}
          <div className="mt-6 w-full max-w-xl">
            <div className="flex items-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md transition-all focus-within:border-brand focus-within:bg-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" className="mr-2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter categories (e.g. Electronics, Fashion, Shoes, Air Fryer)..."
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-white placeholder-[#94a3b8] focus:outline-none"
              />
              {filterQuery && (
                <button type="button" onClick={() => setFilterQuery('')} className="text-xs text-[#94a3b8] hover:text-white">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Trending Curated Collections */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0f172a] sm:text-xl">🔥 Trending Collections</h2>
            <p className="text-xs text-[#64748b]">Handpicked price drops grouped by popular shopping budgets</p>
          </div>
          <Link href="/hot" className="text-xs font-bold text-brand hover:underline">
            View All Hot Deals →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CURATED_COLLECTIONS.map((col, idx) => (
            <Link
              key={idx}
              href={col.href}
              className={`group flex items-center justify-between rounded-2xl border ${col.borderColor} bg-gradient-to-r ${col.color} p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md`}
            >
              <div>
                <span className="text-2xl">{col.emoji}</span>
                <h3 className={`mt-1 text-xs font-black sm:text-sm ${col.textColor}`}>{col.title}</h3>
                <p className="mt-0.5 text-[11px] text-[#64748b]">{col.subtitle}</p>
              </div>
              <span className="text-sm font-bold text-[#64748b] group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Main Mega Categories Grid with 3D Images */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0f172a] sm:text-xl">Browse All Categories</h2>
            <p className="text-xs text-[#64748b]">Explore live price drops, 3D collections, and discount sub-tags</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#475569]">
            {filteredCategories.length} Categories
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border ${cat.borderColor} bg-gradient-to-br ${cat.gradient} p-5 shadow-xs transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl`}
            >
              <div>
                {/* 3D Visual Category Image or Icon Header */}
                {cat.image ? (
                  <Link href={`/categories/${cat.id}`} className="relative mb-4 block overflow-hidden rounded-2xl border-2 border-white/80 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-md">
                      {cat.count}
                    </div>
                  </Link>
                ) : (
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-xs border border-white/70">
                      {cat.emoji}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#0f172a] shadow-2xs">
                      {cat.count}
                    </span>
                  </div>
                )}

                {/* Title & Tagline */}
                <Link href={`/categories/${cat.id}`}>
                  <h3 className="text-base font-black text-[#0f172a] group-hover:text-brand transition-colors">
                    {cat.name}
                  </h3>
                </Link>
                <p className="mt-1 text-xs leading-relaxed text-[#475569]">{cat.tagline}</p>
              </div>

              {/* Sub-Category Filter Chips */}
              <div className="mt-5 border-t border-black/5 pt-3.5">
                <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                  Top Sub-Filters:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cat.subcategories.map((sub, sIdx) => (
                    <Link
                      key={sIdx}
                      href={sub.href}
                      className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#0f172a] shadow-2xs hover:bg-white hover:text-brand hover:shadow-xs transition-all"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AI Deal Engine Channels */}
      <section className="rounded-3xl border border-[#e2e8f0] bg-white p-6 sm:p-8 shadow-xs">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[#16a34a]">
              <span>🤖</span> Real-time AI Sourcing
            </span>
            <h2 className="text-xl font-black tracking-tight text-[#0f172a]">
              Live Monitored Deal Feeds
            </h2>
            <p className="text-xs text-[#64748b]">
              Our crawler monitors leading Telegram &amp; WhatsApp channels every second for lightning price drops
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#16a34a] animate-pulse"></span>
            <span className="text-xs font-bold text-[#16a34a]">AI Crawler Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((ch) => (
            <div
              key={ch.id}
              className="flex flex-col justify-between rounded-2xl border border-[#f1f5f9] bg-[#f8fafc] p-4 transition-all hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-2xs">
                    {ch.emoji}
                  </span>
                  <span className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[9.5px] font-black text-[#16a34a]">
                    LIVE
                  </span>
                </div>
                <h3 className="text-xs font-black text-[#0f172a]">{ch.name}</h3>
                <p className="mt-0.5 text-[11px] text-[#64748b]">{ch.platform}</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[10.5px]">
                <span className="font-extrabold text-[#334155]">{ch.subscribers} Shoppers</span>
                <span className="font-bold text-[#16a34a]">{ch.speed}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs font-medium text-[#94a3b8]">
          🛡️ 100% Genuine Price Drops · Verified Affiliate Feeds · Zero Fake Discounts
        </p>
      </section>
    </div>
  );
}
