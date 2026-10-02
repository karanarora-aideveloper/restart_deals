'use client';

import React, { useState } from 'react';

export default function ProductFAQ({ productTitle = 'this product', merchant = 'Amazon' }) {
  const [openIndex, setOpenIndex] = useState(0);

  const cleanStore = merchant.charAt(0).toUpperCase() + merchant.slice(1);

  const faqs = [
    {
      q: `How accurate is the price history for ${productTitle}?`,
      a: `Our automated scrapers and Telegram verifiers track live price updates from ${cleanStore} multiple times daily. The graph captures real recorded sale prices, deal drops, and MRP strike-through changes.`,
    },
    {
      q: `How do I know if a deal on ${cleanStore} is genuine?`,
      a: `Check our "AI Buying Verdict" above. If a product is marked "🔥 All-Time Low" or "✅ Great Deal", the current price is significantly below its 90-day historical average. If it says "⏳ Wait", the seller may have temporarily raised the price before a sale.`,
    },
    {
      q: `How do WhatsApp and Email price drop alerts work?`,
      a: `Click "🔔 Set Price Alert" and specify your target price. As soon as the price falls to or below your target, our system automatically sends you a direct notification with the instant buy link.`,
    },
    {
      q: `Can I track products from other stores like Flipkart or Myntra?`,
      a: `Yes! Simply copy any product URL from Flipkart, Myntra, Nykaa, or Ajio and paste it into the search bar at the top of the page.`,
    },
  ];

  return (
    <section className="mt-10 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xs">
      <div className="mb-6">
        <h3 className="text-lg font-black text-[#0f172a]">Frequently Asked Questions</h3>
        <p className="text-xs text-[#64748b]">Everything you need to know about price tracking and smart shopping</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-[#f1f5f9] bg-[#fafafa]">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between p-4 text-left text-xs font-extrabold text-[#0f172a]"
              >
                <span>{faq.q}</span>
                <span className="ml-2 text-base text-[#94a3b8]">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[#f1f5f9] bg-white p-4 text-xs leading-relaxed text-[#64748b]">
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
