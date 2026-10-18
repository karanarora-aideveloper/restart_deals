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
  MeeshoLogo,
  CromaLogo,
  BombayShavingCompanyLogo,
  MamaearthLogo,
  BoatLogo,
  BlinkitLogo,
} from '@/components/BrandAndStoreLogos';

export default function V3StoresSection() {
  const stores = [
    { id: 'amazon', name: 'Amazon India', component: <AmazonLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '41,800+ Tracked' },
    { id: 'flipkart', name: 'Flipkart', component: <FlipkartLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '2,400+ Tracked' },
    { id: 'myntra', name: 'Myntra', component: <MyntraLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '1,200+ Tracked' },
    { id: 'shopsy', name: 'Shopsy', component: <ShopsyLogo className="h-5 sm:h-6 w-auto" />, dealsCount: '1,000+ Tracked' },
    { id: 'meesho', name: 'Meesho', component: <MeeshoLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '840+ Tracked' },
    { id: 'nykaa', name: 'Nykaa', component: <NykaaLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '720+ Tracked' },
    { id: 'ajio', name: 'Ajio', component: <AjioLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '720+ Tracked' },
    { id: 'croma', name: 'Croma', component: <CromaLogo className="h-5 sm:h-6 w-auto object-contain" />, dealsCount: '400+ Tracked' },
    { id: 'snitch', name: 'Snitch', component: <span className="text-xs font-black text-slate-900">👔 SNITCH</span>, dealsCount: '120+ Products' },
    { id: 'boat', name: 'boAt', component: <BoatLogo className="h-5 w-auto object-contain" />, dealsCount: 'Top Audio' },
    { id: 'bombayshaving', name: 'Bombay Shaving Co', component: <BombayShavingCompanyLogo className="h-5 w-auto object-contain" />, dealsCount: 'D2C Verified' },
    { id: 'blinkit', name: 'Blinkit', component: <BlinkitLogo className="h-4 sm:h-5 w-auto object-contain" />, dealsCount: '10-Min Live' },
  ];

  return (
    <section className="mx-auto max-w-[1360px] 2xl:max-w-[1400px] px-4 sm:px-6 lg:px-8 my-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        <div className="text-center max-w-xl mx-auto mb-6">
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            Store Coverage
          </span>
          <h2 className="mt-2 text-lg sm:text-xl font-black text-slate-900">
            30+ Leading Indian Stores Monitored 24/7
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Direct real-time price synchronization across 50,000+ products on India’s top marketplaces and authentic D2C brands.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/?merchant=${s.id}#deals`}
              className="flex flex-col items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white p-3.5 sm:p-4 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-md text-center group min-w-0"
              title={`Browse verified price drops on ${s.name}`}
            >
              <div className="h-10 sm:h-12 flex items-center justify-center max-w-full overflow-hidden w-full px-2">
                {s.component}
              </div>
              <div className="mt-2.5 min-w-0 w-full flex flex-col items-center justify-center">
                <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-800 truncate max-w-full">
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
