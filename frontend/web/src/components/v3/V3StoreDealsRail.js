'use client';

import React from 'react';
import Link from 'next/link';
import {
  AmazonLogo,
  FlipkartLogo,
  MyntraLogo,
  NykaaLogo,
  AjioLogo,
  MeeshoLogo,
  CromaLogo,
  MamaearthLogo,
  BoatLogo,
} from '@/components/BrandAndStoreLogos';
import { logEvent } from '@/lib/analytics';

const MONITORED_STORES = [
  {
    id: 'amazon',
    name: 'Amazon India',
    logo: <AmazonLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '3,200+ Verified Deals',
    badgeColor: 'text-amber-800 bg-amber-50 border-amber-200',
    perk: 'Prime Deals & 90-Day Lows',
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    logo: <FlipkartLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '950+ Verified Deals',
    badgeColor: 'text-blue-800 bg-blue-50 border-blue-200',
    perk: 'Mobiles & Electronics Steals',
  },
  {
    id: 'myntra',
    name: 'Myntra',
    logo: <MyntraLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '620+ Verified Deals',
    badgeColor: 'text-pink-800 bg-pink-50 border-pink-200',
    perk: 'Top Brands 50%–80% Off MRP',
  },
  {
    id: 'shopsy',
    name: 'Shopsy',
    logo: <span className="text-sm font-black text-purple-700">🛍️ SHOPSY</span>,
    badge: '180+ Budget Steals',
    badgeColor: 'text-purple-800 bg-purple-50 border-purple-200',
    perk: 'Direct Factory Pricing',
  },
  {
    id: 'nykaa',
    name: 'Nykaa',
    logo: <NykaaLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '480+ Verified Deals',
    badgeColor: 'text-rose-800 bg-rose-50 border-rose-200',
    perk: 'Makeup Shades & Skincare',
  },
  {
    id: 'ajio',
    name: 'Ajio',
    logo: <AjioLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '340+ Verified Deals',
    badgeColor: 'text-slate-800 bg-slate-100 border-slate-300',
    perk: 'Verified Coupon Codes',
  },
  {
    id: 'meesho',
    name: 'Meesho',
    logo: <MeeshoLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '510+ Verified Deals',
    badgeColor: 'text-purple-800 bg-purple-50 border-purple-200',
    perk: 'Budget Fashion & Home Decor',
  },
  {
    id: 'croma',
    name: 'Croma',
    logo: <CromaLogo className="h-5 sm:h-6 w-auto object-contain" />,
    badge: '280+ Verified Deals',
    badgeColor: 'text-teal-800 bg-teal-50 border-teal-200',
    perk: 'Laptops, TVs & Appliances',
  },
  {
    id: 'plum',
    name: 'Plum Goodness',
    logo: <span className="text-xs font-black text-indigo-700">🌿 PLUM GOODNESS</span>,
    badge: 'D2C Verified',
    badgeColor: 'text-indigo-800 bg-indigo-50 border-indigo-200',
    perk: 'Vegan & Toxin-Free Beauty',
  },
  {
    id: 'mamaearth',
    name: 'Mamaearth',
    logo: <MamaearthLogo className="h-5 w-auto object-contain" />,
    badge: 'D2C Verified',
    badgeColor: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    perk: 'Natural Care & Safe Formulations',
  },
  {
    id: 'boat',
    name: 'boAt Lifestyle',
    logo: <BoatLogo className="h-5 w-auto object-contain" />,
    badge: 'Audio Leader',
    badgeColor: 'text-red-800 bg-red-50 border-red-200',
    perk: 'Earbuds, Smartwatches & Audio',
  },
];

export default function V3StoreDealsRail() {
  const handleStoreClick = (store) => {
    logEvent('click_monitored_store_rail', { store_id: store.id, store_name: store.name });
  };

  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              <span>🏪 24/7 Multi-Store Tracking</span>
            </div>
            <h2 className="mt-1.5 text-base sm:text-lg font-black text-slate-900">
              Top Monitored Stores &amp; Verified Deals
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Real-time price drop detection across India’s leading marketplaces and trending D2C brands.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-emerald-50 border border-emerald-200/70 px-3 py-1.5 text-xs font-extrabold text-emerald-800">
              🟢 100% Anti-Inflation Verified
            </span>
          </div>
        </div>

        {/* Store Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {MONITORED_STORES.map((store) => (
            <Link
              key={store.id}
              href={`/?merchant=${store.id}#deals`}
              onClick={() => handleStoreClick(store)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:bg-white hover:shadow-md min-w-0"
            >
              <div>
                {/* Store Logo */}
                <div className="flex h-10 items-center justify-center rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                  {store.logo}
                </div>

                {/* Deal Count Badge */}
                <div className="mt-3 text-center">
                  <span className={`inline-block rounded-lg border px-2 py-0.5 text-[10px] sm:text-[11px] font-black tracking-tight ${store.badgeColor} truncate max-w-full`}>
                    {store.badge}
                  </span>
                </div>

                <p className="mt-1 text-[10px] text-slate-500 font-medium text-center line-clamp-1">
                  {store.perk}
                </p>
              </div>

              {/* View Deals CTA */}
              <div className="mt-3 pt-2 border-t border-slate-100">
                <span className="block w-full rounded-xl bg-indigo-600 py-1.5 px-2 text-center text-[11px] font-extrabold text-white shadow-2xs transition-all group-hover:bg-indigo-700 truncate">
                  Explore Deals →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
