'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const TABS = [
  { id: 'all', label: 'All Lab Reports', count: 6, emoji: '🔬' },
  { id: 'tech', label: 'Smart Tech & Mobiles', count: 2, emoji: '📱' },
  { id: 'appliances', label: 'Home Appliances', count: 2, emoji: '❄️' },
  { id: 'kitchen', label: 'Kitchen & Health', count: 2, emoji: '💧' },
];

const FEATURED_GUIDES = [
  {
    id: 'iphone-bbd-2026',
    tabGroup: 'tech',
    category: 'Market Investigation',
    categoryIcon: '🍎',
    badge: 'OCTOBER 2026 SPECIAL',
    labScore: '9.6',
    auditType: 'TSMC Chip & Wafer Audit',
    title: 'Will iPhone Prices Drop During BBD & Festive Sales? Real Chip & Price Audit',
    subtitle: 'Semiconductor Inflation & Exchange Traps Exposed',
    description: 'With iPhone 18 unreleased and TSMC chip wafer costs up 20%, will Apple prices actually crash? We audited 90-day price trends and bank offers across Amazon & Flipkart.',
    modelsCount: 'iPhone 15, 16, 16 Plus, 17',
    priceRange: '₹48,499 – ₹82,900',
    priceDropHighlight: '₹4,500 Real Drop',
    keySpecs: ['A16/A18 Bionic', 'TSMC 3nm Node', 'Zero Exchange Trap'],
    stores: ['Flipkart', 'Amazon'],
    imageUrl: '/guides/iphone.jpg',
    slug: 'will-iphone-prices-drop-big-billion-days-2026',
    keyTakeaway: 'Verdict: Buy iPhone 15 at flat ₹48,499 without exchange tricks',
  },
  {
    id: 'washing-machines-oct-2026',
    tabGroup: 'appliances',
    category: 'Washing Machines',
    categoryIcon: '🧺',
    badge: 'OCTOBER 2026 REPORT',
    labScore: '9.4',
    auditType: '17,500L Water & Noise Test',
    title: 'Best Washing Machines in India: Front Load vs Top Load Comparison',
    subtitle: 'Water Bills, Inverter Motors & 1400 RPM Spin',
    description: 'A front-loader saves 17,500 litres of water a year. We benchmarked motor decibels, detergent wash cycles, and 90-day drops across Bosch, Samsung, and Electrolux.',
    modelsCount: '4 Models Benchmarked',
    priceRange: '₹27,000 – ₹59,990',
    priceDropHighlight: '₹2,010 Cash Drop',
    keySpecs: ['1400 RPM Spin', '5-Star EcoSilence', '17,500L Water Saved'],
    stores: ['Amazon'],
    imageUrl: '/guides/washing-machine.jpg',
    slug: 'best-washing-machines-india-front-vs-top-load-2026',
    keyTakeaway: 'Top Pick: Bosch 8 kg 5-Star EcoSilence Front Loader (₹48,190)',
  },
  {
    id: 'purifiers-oct-2026',
    tabGroup: 'kitchen',
    category: 'Water Purifiers',
    categoryIcon: '💧',
    badge: 'OCTOBER 2026 REPORT',
    labScore: '9.5',
    auditType: 'TDS & Service Cost Audit',
    title: 'Best Water Purifiers with Zero AMC & 2-Year Filter Life',
    subtitle: 'Tested Lab Verdict & True Filter Replacement Costs',
    description: 'Stop paying ₹4,000–₹6,000 yearly for service visits. 4 top purifiers with 2-year unconditional filter lifespans compared against live store selling prices.',
    modelsCount: '4 Models Compared',
    priceRange: '₹10,999 – ₹16,999',
    priceDropHighlight: '₹1,200 Price Drop',
    keySpecs: ['Zero AMC Guarantee', '45 PPM Clean TDS', '2-Year Filter Life'],
    stores: ['Amazon', 'Flipkart'],
    imageUrl: '/guides/water-purifier.jpg',
    slug: 'best-water-purifiers-no-service-zero-amc-india-2026',
    keyTakeaway: 'Top Pick: Urban Company Native M1 (2-yr unconditional warranty)',
  },
  {
    id: 'inverter-acs-oct-2026',
    tabGroup: 'appliances',
    category: 'Air Conditioners',
    categoryIcon: '❄️',
    badge: 'OCTOBER 2026 REPORT',
    labScore: '9.3',
    auditType: 'ISEER 5.2 Electricity Audit',
    title: 'Best 1.5 Ton 5-Star Inverter ACs: Power Bills & Price Drops',
    subtitle: 'ISEER Electricity Audit & Genuine Discounts',
    description: 'Avoid inflated MRP discount traps. We analyzed 5800W cooling capacity, annual electricity units, and 90-day price drops across LG, Whirlpool, IFB, and Carrier.',
    modelsCount: '4 Models Compared',
    priceRange: '₹35,990 – ₹48,490',
    priceDropHighlight: '₹2,000 Real Drop',
    keySpecs: ['5800W Heavy Cooling', 'ISEER 5.2 Rating', '₹4,200 Annual Saving'],
    stores: ['Amazon', 'Flipkart'],
    imageUrl: '/guides/inverter-ac.jpg',
    slug: 'best-1-5-ton-inverter-ac-india-2026',
    keyTakeaway: 'Top Pick: LG AI Convertible 6-in-1 (Ocean Black Anti-Corrosion)',
  },
  {
    id: 'air-fryers-oct-2026',
    tabGroup: 'kitchen',
    category: 'Air Fryers',
    categoryIcon: '🍟',
    badge: 'OCTOBER 2026 REPORT',
    labScore: '9.2',
    auditType: '360° Aero-Crisp Heat Test',
    title: 'Best Air Fryers in India (4L–6L): Rapid Air Tech & Real Drops',
    subtitle: 'Samosa Crisping, 1600W Power & Easy Cleaning',
    description: 'Crispy Indian snacks with 90% less oil. We tested heating uniformity, digital presets, and 90-day price cuts across Havells, Tower, and Milton.',
    modelsCount: '3 Models Compared',
    priceRange: '₹3,199 – ₹4,150',
    priceDropHighlight: '₹950 Real Drop',
    keySpecs: ['90% Less Oil', '1600W Uniform Heat', '360° Aero-Crisp'],
    stores: ['Amazon'],
    imageUrl: '/guides/air-fryer.jpg',
    slug: 'best-air-fryers-india-digital-rapid-air-2026',
    keyTakeaway: 'Top Pick: Havells Prolife Brio 4.2L (Aero Crisp 360° Tech)',
  },
  {
    id: 'monitors-oct-2026',
    tabGroup: 'tech',
    category: 'Monitors',
    categoryIcon: '🖥️',
    badge: 'OCTOBER 2026 REPORT',
    labScore: '9.5',
    auditType: '180Hz Gray-to-Gray Shootout',
    title: 'Best Monitors for Work & Gaming: IPS vs 1000R Curved Shootout',
    subtitle: '180Hz Esports Panels & Eye Fatigue Reduction',
    description: 'Upgrade from a cramped laptop screen. We benchmarked sRGB color accuracy, 180Hz refresh rate, and 90-day price drops across MSI, Samsung, and LG.',
    modelsCount: '4 Models Benchmarked',
    priceRange: '₹7,499 – ₹12,498',
    priceDropHighlight: '₹3,500 Price Cut',
    keySpecs: ['180Hz Fast-IPS', '1ms Gray-to-Gray', 'sRGB 99% Calibrated'],
    stores: ['Amazon', 'Flipkart'],
    imageUrl: '/guides/monitor.jpg',
    slug: 'best-monitors-work-gaming-india-2026',
    keyTakeaway: 'Top Pick: MSI MAG 27" 180Hz Fast-IPS (₹12,498 on Flipkart)',
  },
];

const PHONE_BUDGET_GUIDES = [
  { label: 'Under ₹15,000', slug: 'best-phones-under-15000-india-2026', tag: '120Hz & 5000mAh', icon: '⚡' },
  { label: 'Under ₹20,000', slug: 'best-phones-under-20000-india-2026', tag: 'AMOLED & OIS', icon: '📸' },
  { label: 'Under ₹25,000', slug: 'best-phones-under-25000-india-2026', tag: 'Sony IMX & 100W', icon: '🔋' },
  { label: 'Under ₹30,000', slug: 'best-phones-under-30000-india-2026', tag: 'Flagship Killers', icon: '🚀' },
  { label: 'Under ₹35,000', slug: 'best-phones-under-35000-india-2026', tag: 'Snapdragon 8s Gen', icon: '🎮' },
  { label: 'Under ₹40,000', slug: 'best-phones-under-40000-india-2026', tag: 'Near-Flagship Premium', icon: '👑' },
];

export default function V3SmartBuyersGuides() {
  const [activeTab, setActiveTab] = useState('all');

  const currentMonthYear = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const filteredGuides = activeTab === 'all'
    ? FEATURED_GUIDES
    : FEATURED_GUIDES.filter((g) => g.tabGroup === activeTab);

  return (
    <section aria-labelledby="v3-buyers-guides-heading" className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-8">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 lg:p-7 shadow-xs">
        {/* Header with Live Monthly Timestamp & Authority Badge */}
        <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end border-b border-slate-100 pb-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200/90 bg-indigo-50/80 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600"></span>
              </span>
              <span>Hardware &amp; Price Intelligence Lab · {currentMonthYear} Edition</span>
            </div>
            <h2
              id="v3-buyers-guides-heading"
              className="text-lg sm:text-xl font-black tracking-tight text-slate-900"
            >
              Smart Buyer&apos;s Guides &amp; Multi-Store Benchmarks
            </h2>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
              High-ticket electronics and appliances audited side-by-side with 90-day price history, verified festive discounts, and true running costs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs text-slate-600">
              <span className="text-emerald-600 font-bold">✓ Zero Sponsored</span>
              <span>·</span>
              <span className="text-indigo-600 font-bold">100% Lab Tested</span>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700 transition-all hover:bg-indigo-100 hover:border-indigo-300 shrink-0"
            >
              <span>View All 30+ Reports</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Interactive Category Filter Pills */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-white'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${activeTab === tab.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Phone Budget Quick-Jump Strip */}
        <div className="mb-8 rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-indigo-50/70 p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📱</span>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                Smartphone Buying Guides by Exact Budget ({currentMonthYear})
              </span>
            </div>
            <span className="text-[11px] font-bold text-indigo-700">
              Audited against Amazon GIF &amp; Flipkart BBD
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {PHONE_BUDGET_GUIDES.map((tier) => (
              <Link
                key={tier.slug}
                href={`/blog/${tier.slug}`}
                className="flex flex-col items-center justify-center rounded-xl border border-indigo-200/70 bg-white py-2.5 px-3 text-center shadow-2xs transition-all hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-xs group"
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs">{tier.icon}</span>
                  <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {tier.label}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  {tier.tag}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 3-Column Responsive Grid (6 Highlighted High-Ticket Guides) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGuides.map((guide) => (
            <Link
              key={guide.id}
              href={`/blog/${guide.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-400 hover:shadow-2xl"
            >
              {/* Visual Hero with Category Tag & Store Badges */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                <Image
                  src={guide.imageUrl}
                  alt={guide.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority={guide.id === 'iphone-bbd-2026'}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>

                {/* Top Badges: Category + Lab Score */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-white backdrop-blur-md border border-white/10 shadow-xs">
                    {guide.categoryIcon} {guide.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[11px] font-black text-slate-950 shadow-xs flex items-center gap-1">
                      <span>★</span>
                      <span>{guide.labScore}</span>
                    </span>
                    <span className="rounded-lg bg-indigo-600 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-white shadow-xs">
                      {guide.badge.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Price Range & Real Drop Highlight */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      Tested Bracket
                    </span>
                    <span className="text-xs font-black text-white drop-shadow-xs">
                      {guide.priceRange}
                    </span>
                  </div>
                  <span className="rounded-md bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-slate-950 shadow-sm">
                    {guide.priceDropHighlight}
                  </span>
                </div>
              </div>

              {/* Content Body */}
              <div className="flex flex-1 flex-col p-5">
                {/* Audit Type Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    🔬 {guide.auditType}
                  </span>
                  <span className="text-[10.5px] font-bold text-slate-500">
                    {guide.modelsCount}
                  </span>
                </div>

                <h3 className="line-clamp-2 text-base font-black leading-snug text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {guide.title}
                </h3>
                <p className="line-clamp-2 mt-2 text-xs leading-relaxed text-slate-600">
                  {guide.description}
                </p>

                {/* Key Spec Benchmark Pill Strip */}
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {guide.keySpecs.map((spec, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/80"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Key Takeaway Box */}
                <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-[11.5px] font-bold text-emerald-900">
                  <span className="mr-1">💡</span>
                  <span>{guide.keyTakeaway}</span>
                </div>

                {/* Footer Meta: Stores & CTA */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <span>Audited on:</span>
                    <span className="font-bold text-slate-800">{guide.stores.join(' & ')}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 group-hover:translate-x-1 transition-transform">
                    <span>Read Audit Report</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
