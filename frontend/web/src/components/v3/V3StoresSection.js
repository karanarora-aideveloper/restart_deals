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
} from '@/components/v2/BrandAndStoreLogos';

export default function V3StoresSection() {
  const stores = [
    { id: 'amazon', name: 'Amazon India', component: <AmazonLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '1,200+ Deals' },
    { id: 'flipkart', name: 'Flipkart', component: <FlipkartLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '950+ Deals' },
    { id: 'myntra', name: 'Myntra', component: <MyntraLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '620+ Deals' },
    { id: 'nykaa', name: 'Nykaa', component: <NykaaLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '480+ Deals' },
    { id: 'ajio', name: 'Ajio', component: <AjioLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '340+ Deals' },
    { id: 'meesho', name: 'Meesho', component: <MeeshoLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '510+ Deals' },
    { id: 'croma', name: 'Croma', component: <CromaLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '280+ Deals' },
  ];

  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-12">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 lg:p-10 shadow-sm">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
            Store Coverage
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
            Over 100K+ Stores Monitored 24/7
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
            Direct real-time price synchronization across India’s leading retail and lifestyle platforms.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/v3#deals`}
              className="flex flex-col items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 sm:p-4 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:bg-white hover:shadow-md text-center group min-w-0"
            >
              <div className="h-8 sm:h-10 flex items-center justify-center max-w-full overflow-hidden">
                {s.component}
              </div>
              <div className="mt-2.5 min-w-0 w-full">
                <span className="block text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                  {s.name}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 block truncate mt-0.5">
                  {s.dealsCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
