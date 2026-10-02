'use client';

import React from 'react';
import {
  AmazonLogo,
  FlipkartLogo,
  MyntraLogo,
  NykaaLogo,
  AjioLogo,
  MeeshoLogo,
  CromaLogo,
} from '@/components/v2/BrandAndStoreLogos';
import { getAffiliateUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';

const CASHBACK_STORES = [
  {
    id: 'amazon',
    name: 'Amazon India',
    logo: <AmazonLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Up to 5% Rewards',
    rateColor: 'text-amber-700 bg-amber-50 border-amber-200',
    url: 'https://www.amazon.in/?tag=shoppersdeal0d-21',
    perk: 'Extra rewards on electronics & fashion',
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    logo: <FlipkartLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Up to 7% Rewards',
    rateColor: 'text-blue-700 bg-blue-50 border-blue-200',
    url: 'https://www.flipkart.com',
    perk: 'Real cashback on smartphones & TVs',
  },
  {
    id: 'myntra',
    name: 'Myntra',
    logo: <MyntraLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Flat 8.5% Cashback',
    rateColor: 'text-pink-700 bg-pink-50 border-pink-200',
    url: 'https://www.myntra.com',
    perk: 'Highest cashback on shoes & apparel',
  },
  {
    id: 'nykaa',
    name: 'Nykaa',
    logo: <NykaaLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Up to 10% Cashback',
    rateColor: 'text-rose-700 bg-rose-50 border-rose-200',
    url: 'https://www.nykaa.com',
    perk: 'Extra cash on cosmetics & skincare',
  },
  {
    id: 'ajio',
    name: 'Ajio',
    logo: <AjioLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Flat 9% Cashback',
    rateColor: 'text-slate-800 bg-slate-100 border-slate-300',
    url: 'https://www.ajio.com',
    perk: 'Valid on top of sale promo codes',
  },
  {
    id: 'meesho',
    name: 'Meesho',
    logo: <MeeshoLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Flat 6% Cashback',
    rateColor: 'text-purple-700 bg-purple-50 border-purple-200',
    url: 'https://www.meesho.com',
    perk: 'Lowest price fashion & home decor',
  },
  {
    id: 'croma',
    name: 'Croma',
    logo: <CromaLogo className="h-5 sm:h-6 w-auto object-contain" />,
    cashbackRate: 'Up to 3.5% Cashback',
    rateColor: 'text-teal-800 bg-teal-50 border-teal-200',
    url: 'https://www.croma.com',
    perk: 'Valid on ACs, Fridges & Laptops',
  },
];

export default function V3CashbackStoresRail() {
  const handleStoreClick = (store) => {
    logEvent('click_cashback_store', { store_id: store.id, store_name: store.name, rate: store.cashbackRate });
  };

  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-8">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
              <span>💰 CashKaro-Style Cashback Hub</span>
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-slate-900">
              Top Stores with Real Cashback &amp; Rewards
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Click out to your favorite store and earn real cash transferrable to your Bank account or UPI.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-indigo-50 border border-indigo-200/70 px-3 py-1.5 text-xs font-extrabold text-indigo-700">
              ⚡ Over ₹10 Crore Cashback Paid
            </span>
          </div>
        </div>

        {/* Store Grid (Responsive with min-w-0 and zero text overflow) */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {CASHBACK_STORES.map((store) => {
            const affiliateUrl = getAffiliateUrl(store.url, 'IN');
            return (
              <div
                key={store.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-lg min-w-0"
              >
                <div>
                  {/* Store Logo */}
                  <div className="flex h-10 items-center justify-center rounded-xl bg-slate-50/80 p-2 border border-slate-100">
                    {store.logo}
                  </div>

                  {/* Cashback Rate Badge */}
                  <div className="mt-3 text-center">
                    <span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-black tracking-tight ${store.rateColor}`}>
                      {store.cashbackRate}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[10px] text-slate-500 font-medium text-center line-clamp-1">
                    {store.perk}
                  </p>
                </div>

                {/* Activate Cashback CTA */}
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <a
                    href={affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleStoreClick(store)}
                    className="block w-full rounded-xl bg-emerald-600 py-1.5 px-2 text-center text-[11px] font-extrabold text-white shadow-2xs transition-all hover:bg-emerald-700 active:scale-95 truncate"
                  >
                    <span>Activate Cashback →</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
