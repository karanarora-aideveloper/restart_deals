'use client';

import React from 'react';
import Link from 'next/link';

const CARDS_TEASER = [
  {
    id: 'flipkart-axis',
    bank: 'Axis Bank',
    name: 'Flipkart Axis Bank Card',
    tag: '5% Unlimited',
    tagColor: 'bg-blue-50 text-blue-800 border-blue-200',
    highlight: '5% unlimited on Flipkart & Myntra + 4% on Swiggy.',
    annualFee: '₹500 / yr',
    applyUrl: '/credit-cards',
  },
  {
    id: 'amazon-pay-icici',
    bank: 'ICICI Bank',
    name: 'Amazon Pay ICICI Card',
    tag: 'Lifetime Free',
    tagColor: 'bg-amber-50 text-amber-900 border-amber-300',
    highlight: '5% on Amazon for Prime + 2% on bills & recharge.',
    annualFee: '₹0 (Free Forever)',
    applyUrl: '/credit-cards',
  },
  {
    id: 'swiggy-hdfc',
    bank: 'HDFC Bank',
    name: 'Swiggy HDFC Bank Card',
    tag: '10% on Swiggy',
    tagColor: 'bg-orange-50 text-orange-800 border-orange-200',
    highlight: '10% on Swiggy & Instamart + 5% on 1,000+ apps.',
    annualFee: '₹500 / yr',
    applyUrl: '/credit-cards',
  },
  {
    id: 'sbi-cashback',
    bank: 'SBI Card',
    name: 'Cashback SBI Card',
    tag: '5% Universal',
    tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    highlight: 'Flat 5% on ALL online shopping across all websites.',
    annualFee: '₹999 / yr',
    applyUrl: '/credit-cards',
  },
  {
    id: 'tata-neu',
    bank: 'HDFC Bank',
    name: 'Tata Neu Infinity HDFC',
    tag: '10% NeuCoins',
    tagColor: 'bg-purple-50 text-purple-800 border-purple-200',
    highlight: '10% on BigBasket, Croma & 1mg + 1.5% UPI cashback.',
    annualFee: '₹1,499 / yr',
    applyUrl: '/credit-cards',
  },
];

export default function V3CreditCardTeaser() {
  return (
    <section className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-6">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 p-4 sm:p-5 shadow-2xs">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-lg">💳</span>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
              Top E-Commerce Credit Cards &amp; Bank Offers
            </h3>
            <span className="hidden md:inline rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold">
              Instant 5% to 10% Discounts
            </span>
          </div>

          <Link
            href="/credit-cards"
            className="text-[11px] sm:text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>Compare All Cards</span>
            <span>→</span>
          </Link>
        </div>

        {/* 1-Row Horizontally Scrollable Rail */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
          {CARDS_TEASER.map((card) => (
            <Link
              key={card.id}
              href={card.applyUrl}
              className="w-64 sm:w-72 shrink-0 flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {card.bank}
                  </span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${card.tagColor}`}>
                    {card.tag}
                  </span>
                </div>

                <h4 className="mt-1.5 text-xs sm:text-[13px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                  {card.name}
                </h4>

                <p className="mt-1 text-[11px] text-slate-600 line-clamp-1">
                  {card.highlight}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-semibold">{card.annualFee}</span>
                <span className="font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                  View Offers →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
