'use client';

import React, { useState } from 'react';

const FAQS = [
  {
    q: 'How does the 90-day price history tracker work?',
    a: 'Our autonomous bots monitor products continuously via rotating anti-detect residential proxies. Every day, we record real selling prices and bank offers into an immutable checkpoint. When you search or paste a link, we plot the full 90-day price curve so you know whether the current price is genuinely low or marked up.',
  },
  {
    q: 'How do you detect fake discounts during festival sales (Amazon GIF / Flipkart BBD)?',
    a: 'Retailers frequently inflate the printed MRP or bump the selling price 7 to 10 days before major sales, only to claim a "50% off" discount. Our Smart Deal Scanner compares the live price against the 90-day average selling price, instantly flagging artificial discount claims.',
  },
  {
    q: 'What is the difference between an MRP discount and a Genuine Price Drop?',
    a: 'MRP discount is calculated against the maximum retail price printed on the box (which is often arbitrary and permanently discounted). A Genuine Price Drop is calculated against what the item actually sold for yesterday or last week. We clearly separate both metrics on every deal card.',
  },
  {
    q: 'How do I receive instant price drop alerts for products I track?',
    a: 'You can tap the bell icon or save any product to your OneList. When the price drops below your desired threshold across Amazon, Flipkart, or Nykaa, our Telegram Bot (@ShoppersDealsAlertBot) and browser WebPush notify you in under 60 seconds.',
  },
  {
    q: 'Is the ShoppersDeals browser extension and website 100% free?',
    a: 'Yes, 100% free. We never charge users. When you click our verified deals or buy through our links, we may earn a small affiliate commission from stores at no extra cost to you.',
  },
];

export default function V3FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="mx-auto max-w-4xl px-4 my-14">
      <div className="text-center mb-8">
        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
          Knowledge Base
        </span>
        <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
          Frequently Asked Questions
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
          Everything you need to know about price tracking, discount verification, and smart shopping.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                className="flex w-full items-center justify-between text-left gap-4"
              >
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {faq.q}
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 transition-transform ${
                  isOpen ? 'rotate-180 bg-indigo-100 text-indigo-700' : ''
                }`}>
                  ↓
                </span>
              </button>

              {isOpen && (
                <div className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-600 pt-3 border-t border-slate-100">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
