import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const FEATURED_GUIDES = [
  {
    id: 'iphone-bbd-2026',
    category: 'Market Investigation',
    categoryIcon: '🍎',
    badge: 'OCTOBER 2026 SPECIAL',
    title: 'Will iPhone Prices Drop During BBD & Festive Sales? Real Chip & Price Audit',
    subtitle: 'Semiconductor Inflation & Exchange Traps Exposed',
    description: 'With iPhone 18 unreleased and TSMC chip wafer costs up 20%, will Apple prices actually crash? We audited 90-day price trends and bank offers.',
    modelsCount: 'iPhone 15, 16, 16 Plus, 17',
    priceRange: '₹48,499 – ₹82,900',
    stores: ['Flipkart', 'Amazon'],
    savingsHighlight: 'Exposes the ₹39,999 marketing illusion',
    imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&q=80&w=600',
    slug: 'will-iphone-prices-drop-big-billion-days-2026',
    keyTakeaway: 'Verdict: Buy iPhone 15 at flat ₹48,499 without exchange tricks',
  },
  {
    id: 'washing-machines-oct-2026',
    category: 'Washing Machines',
    categoryIcon: '🧺',
    badge: 'OCTOBER 2026 REPORT',
    title: 'Best Washing Machines in India: Front Load vs Top Load Comparison',
    subtitle: 'Water Bills, Inverter Motors & 1400 RPM Spin',
    description: 'A front-loader saves 17,500 litres of water a year. We audited motor noise, stain removal, and 90-day drops across Bosch, Samsung, and Electrolux.',
    modelsCount: '4 Models Compared',
    priceRange: '₹27,000 – ₹59,990',
    stores: ['Amazon'],
    savingsHighlight: 'Save up to ₹11,900 on water & power bills',
    imageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=600',
    slug: 'best-washing-machines-india-front-vs-top-load-2026',
    keyTakeaway: 'Top Pick: Bosch 8 kg 5-Star EcoSilence Front Loader (₹48,190)',
  },
  {
    id: 'purifiers-oct-2026',
    category: 'Water Purifiers',
    categoryIcon: '💧',
    badge: 'OCTOBER 2026 REPORT',
    title: 'Best Water Purifiers with Zero AMC & 2-Year Filter Life',
    subtitle: 'Tested Lab Verdict & True Filter Costs',
    description: 'Stop paying ₹4,000–₹6,000 yearly for filter changes and service visits. 4 top purifiers with 2-year filter lifespans compared against live prices.',
    modelsCount: '4 Models Compared',
    priceRange: '₹10,999 – ₹16,999',
    stores: ['Amazon', 'Flipkart'],
    savingsHighlight: 'Save up to ₹25,000 over 5 years on AMC',
    imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&q=80&w=600',
    slug: 'best-water-purifiers-no-service-zero-amc-india-2026',
    keyTakeaway: 'Top Pick: Urban Company Native M1 (2-yr unconditional warranty)',
  },
  {
    id: 'inverter-acs-oct-2026',
    category: 'Air Conditioners',
    categoryIcon: '❄️',
    badge: 'OCTOBER 2026 REPORT',
    title: 'Best 1.5 Ton 5-Star Inverter ACs: Power Bills & Price Drops',
    subtitle: 'ISEER Electricity Audit & Genuine Discounts',
    description: 'Avoid inflated MRP discount traps. We analyzed 5800W cooling capacity, annual electricity units, and 90-day price drops across LG, Whirlpool, IFB, and Carrier.',
    modelsCount: '4 Models Compared',
    priceRange: '₹35,990 – ₹48,490',
    stores: ['Amazon', 'Flipkart'],
    savingsHighlight: 'True festive drops up to ₹42,300 off MRP',
    imageUrl: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&q=80&w=600',
    slug: 'best-1-5-ton-inverter-ac-india-2026',
    keyTakeaway: 'Top Pick: LG AI Convertible 6-in-1 (Ocean Black Anti-Corrosion)',
  },
  {
    id: 'air-fryers-oct-2026',
    category: 'Air Fryers',
    categoryIcon: '🍟',
    badge: 'OCTOBER 2026 REPORT',
    title: 'Best Air Fryers in India (4L–6L): Rapid Air Tech & Real Drops',
    subtitle: 'Samosa Crisping, 1600W Power & Easy Cleaning',
    description: 'Crispy Indian snacks with 90% less oil. We tested heating uniformity, digital presets, and 90-day price cuts across Havells, Tower, and Milton.',
    modelsCount: '3 Models Compared',
    priceRange: '₹3,199 – ₹4,150',
    stores: ['Amazon'],
    savingsHighlight: 'Tower 4.5L Digital dropped 56% to ₹3,299',
    imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&q=80&w=600',
    slug: 'best-air-fryers-india-digital-rapid-air-2026',
    keyTakeaway: 'Top Pick: Havells Prolife Brio 4.2L (Aero Crisp 360° Tech)',
  },
  {
    id: 'monitors-oct-2026',
    category: 'Monitors',
    categoryIcon: '🖥️',
    badge: 'OCTOBER 2026 REPORT',
    title: 'Best Monitors for Work & Gaming: IPS vs 1000R Curved Shootout',
    subtitle: '180Hz Esports Panels & Eye Fatigue Reduction',
    description: 'Upgrade from a cramped laptop screen. We benchmarked sRGB color accuracy, 180Hz refresh rate, and 90-day price drops across MSI, Samsung, and LG.',
    modelsCount: '4 Models Compared',
    priceRange: '₹7,499 – ₹12,498',
    stores: ['Amazon', 'Flipkart'],
    savingsHighlight: 'Samsung 27" Curved dropped 45% to ₹9,594',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600',
    slug: 'best-monitors-work-gaming-india-2026',
    keyTakeaway: 'Top Pick: MSI MAG 27" 180Hz Fast-IPS (₹12,498 on Flipkart)',
  },
];

const PHONE_BUDGET_GUIDES = [
  { label: 'Under ₹15,000', slug: 'best-phones-under-15000-india-2026', tag: '120Hz & 5000mAh' },
  { label: 'Under ₹20,000', slug: 'best-phones-under-20000-india-2026', tag: 'AMOLED & OIS' },
  { label: 'Under ₹25,000', slug: 'best-phones-under-25000-india-2026', tag: 'Sony IMX & 100W' },
  { label: 'Under ₹30,000', slug: 'best-phones-under-30000-india-2026', tag: 'Flagship Killers' },
  { label: 'Under ₹35,000', slug: 'best-phones-under-35000-india-2026', tag: 'Snapdragon 8s Gen' },
  { label: 'Under ₹40,000', slug: 'best-phones-under-40000-india-2026', tag: 'Premium Near-Flagship' },
];

export default function SmartBuyersGuidesSection() {
  const currentMonthYear = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <section aria-labelledby="buyers-guides-heading" className="my-10">
      {/* Header with Live Monthly Timestamp & Authority Badge */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/80 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span>Monthly Buyer Intelligence · {currentMonthYear} Edition</span>
          </div>
          <h2
            id="buyers-guides-heading"
            className="text-xl font-black tracking-tight text-[#0f172a] sm:text-2xl"
          >
            Smart Buyer&apos;s Guides &amp; Multi-Store Comparisons
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 max-w-2xl">
            High-ticket electronics and appliances compared side-by-side with 90-day price history, verified festive discounts, and true running costs.
          </p>
        </div>

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 self-start text-xs font-black text-brand transition hover:text-brand-dark sm:self-auto"
        >
          <span>View All 30+ Buying Reports</span>
          <span>→</span>
        </Link>
      </div>

      {/* Phone Budget Quick-Jump Strip */}
      <div className="mb-6 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-blue-50/70 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">📱</span>
            <span className="text-xs font-black uppercase tracking-wider text-blue-950">
              Smartphone Buying Guides by Exact Budget (October 2026)
            </span>
          </div>
          <span className="text-[11px] font-bold text-blue-700">Audited against Amazon GIF &amp; Flipkart BBD</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {PHONE_BUDGET_GUIDES.map((tier) => (
            <Link
              key={tier.slug}
              href={`/blog/${tier.slug}`}
              className="flex flex-col items-center justify-center rounded-xl border border-blue-200/60 bg-white py-2 px-2.5 text-center shadow-2xs transition hover:border-brand hover:bg-orange-50/40 hover:shadow-xs group"
            >
              <span className="text-xs font-black text-gray-900 group-hover:text-brand transition-colors">
                {tier.label}
              </span>
              <span className="text-[10px] font-semibold text-gray-500">
                {tier.tag}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 3-Column Responsive Grid (6 Highlighted High-Ticket Guides) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURED_GUIDES.map((guide) => (
          <Link
            key={guide.id}
            href={`/blog/${guide.slug}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-gray-200/90 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
          >
            {/* Visual Hero with Category Tag & Store Badges */}
            <div className="relative h-48 w-full overflow-hidden bg-gray-100">
              <Image
                src={guide.imageUrl}
                alt={guide.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

              {/* Category & Date Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-white backdrop-blur-xs">
                  {guide.categoryIcon} {guide.category}
                </span>
                <span className="rounded-lg bg-brand px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-xs">
                  {guide.badge}
                </span>
              </div>

              {/* Price Range Pill on Bottom of Image */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                <span className="text-xs font-bold text-gray-200">
                  {guide.modelsCount}
                </span>
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-black backdrop-blur-xs">
                  {guide.priceRange}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex flex-1 flex-col p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand mb-1">
                {guide.subtitle}
              </p>
              <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-[#0f172a] group-hover:text-brand transition-colors">
                {guide.title}
              </h3>
              <p className="line-clamp-2 mt-2 text-xs leading-relaxed text-gray-600">
                {guide.description}
              </p>

              {/* Key Takeaway Box */}
              <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 text-[11.5px] font-bold text-emerald-900">
                <span className="mr-1">💡</span>
                <span>{guide.keyTakeaway}</span>
              </div>

              {/* Footer Meta: Stores & CTA */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <span>Stores:</span>
                  <span className="font-bold text-gray-700">{guide.stores.join(' · ')}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-black text-brand group-hover:translate-x-0.5 transition-transform">
                  Read Guide →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
