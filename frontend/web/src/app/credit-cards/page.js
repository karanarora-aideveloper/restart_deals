import React from 'react';
import Link from 'next/link';
import V3CreditCardSection from '@/components/v3/V3CreditCardSection';

export const metadata = {
  title: 'Best Credit Cards in India (2026) — Offers, Instant Discounts & Rewards | ShoppersDeals',
  description: 'Compare top e-commerce credit cards for Amazon, Flipkart, Swiggy & Blinkit. Find lifetime free cards, instant discounts, and exclusive cash rewards.',
};

export default function CreditCardsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFC] py-6 sm:py-10">
      <div className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">Credit Cards &amp; Bank Offers</span>
        </nav>
      </div>

      {/* Full Credit Card Comparison & Recommendation Hub */}
      <V3CreditCardSection />
    </div>
  );
}
