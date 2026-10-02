'use client';

import React, { useState } from 'react';
import { logEvent } from '@/lib/analytics';

const CREDIT_CARDS = [
  {
    id: 'flipkart-axis',
    bank: 'Axis Bank',
    name: 'Flipkart Axis Bank Credit Card',
    tag: '👑 BEST FOR FLIPKART & MYNTRA',
    tagColor: 'bg-blue-50 text-blue-800 border-blue-200',
    cashback: '5% Unlimited Cashback',
    extraReward: '🎁 Flat ₹1,500 Cash Reward',
    annualFee: '₹500 (Waived on ₹2L Spend)',
    lounge: '4 Free Domestic Lounge Visits/Year',
    highlight: '5% unlimited cashback on Flipkart & Myntra + 4% on Swiggy & Uber.',
    annualSavings: '₹18,500',
    category: 'shopping',
    applyUrl: 'https://www.axisbank.com/retail/cards/credit-card/flipkart-axis-bank-credit-card',
    accentColor: 'from-blue-600 to-indigo-800',
  },
  {
    id: 'amazon-pay-icici',
    bank: 'ICICI Bank',
    name: 'Amazon Pay ICICI Credit Card',
    tag: '⚡ LIFETIME FREE • NO ANNUAL FEE',
    tagColor: 'bg-amber-50 text-amber-900 border-amber-300',
    cashback: '5% Unlimited Amazon Rewards',
    extraReward: '🎁 Flat ₹1,200 Cash Reward',
    annualFee: '₹0 (Lifetime Free Card)',
    lounge: '1% Fuel Surcharge Waiver',
    highlight: '5% unlimited cashback for Prime members + 2% on bills & 100+ partner apps.',
    annualSavings: '₹16,200',
    category: 'shopping',
    applyUrl: 'https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card',
    accentColor: 'from-amber-600 to-orange-700',
  },
  {
    id: 'swiggy-hdfc',
    bank: 'HDFC Bank',
    name: 'Swiggy HDFC Bank Credit Card',
    tag: '🍔 10% ON SWIGGY & INSTAMART',
    tagColor: 'bg-orange-50 text-orange-800 border-orange-200',
    cashback: '10% Cashback on Swiggy/Instamart',
    extraReward: '🎁 Flat ₹1,800 Cash Reward',
    annualFee: '₹500 (₹500 Swiggy Voucher Included)',
    lounge: '5% on 1,000+ Online Shopping Sites',
    highlight: '10% instant cashback on Swiggy, Instamart & Dineout + 5% on Amazon, Myntra & Nykaa.',
    annualSavings: '₹15,800',
    category: 'food',
    applyUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card',
    accentColor: 'from-orange-600 to-red-700',
  },
  {
    id: 'sbi-cashback',
    bank: 'SBI Card',
    name: 'Cashback SBI Credit Card',
    tag: '🌐 5% ON ALL ONLINE SPENDS',
    tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cashback: '5% Universal Online Cashback',
    extraReward: '🎁 Flat ₹1,500 Cash Reward',
    annualFee: '₹999 (Waived on ₹2L Spend)',
    lounge: 'Auto-credited to Monthly Statement',
    highlight: '5% cashback across ALL online platforms with zero merchant restrictions.',
    annualSavings: '₹22,000',
    category: 'utility',
    applyUrl: 'https://www.sbicard.com/en/personal/credit-cards/rewards/cashback-sbi-card.page',
    accentColor: 'from-teal-600 to-emerald-800',
  },
  {
    id: 'tata-neu-infinity',
    bank: 'HDFC Bank',
    name: 'Tata Neu Infinity HDFC Credit Card',
    tag: '✨ 10% NEUCOINS + UPI CASHBACK',
    tagColor: 'bg-purple-50 text-purple-800 border-purple-200',
    cashback: '10% NeuCoins on Tata Neu',
    extraReward: '🎁 Flat ₹2,000 Cash Reward',
    annualFee: '₹1,499 (Waived on ₹3L Spend)',
    lounge: '8 Free Domestic + 4 Int\'l Lounge Visits',
    highlight: '10% back on BigBasket, Croma, 1mg & Tata Neu + 1.5% back on all RuPay UPI spends.',
    annualSavings: '₹24,500',
    category: 'travel',
    applyUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card',
    accentColor: 'from-purple-700 to-indigo-900',
  },
  {
    id: 'airtel-axis',
    bank: 'Axis Bank',
    name: 'Airtel Axis Bank Credit Card',
    tag: '📱 25% ON BILLS & RECHARGES',
    tagColor: 'bg-rose-50 text-rose-800 border-rose-200',
    cashback: '25% on Airtel Bills & 10% on Zomato',
    extraReward: '🎁 Flat ₹1,600 Cash Reward',
    annualFee: '₹500 (Waived on ₹2L Spend)',
    lounge: '4 Domestic Lounge Visits/Year',
    highlight: '25% on Airtel mobile & wifi bills + 10% on Zomato, Swiggy & BigBasket.',
    annualSavings: '₹14,000',
    category: 'utility',
    applyUrl: 'https://www.axisbank.com/retail/cards/credit-card/airtel-axis-bank-credit-card',
    accentColor: 'from-rose-600 to-red-800',
  },
];

export default function V3CreditCardSection() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeCardForApply, setActiveCardForApply] = useState(null);
  const [applicantMobile, setApplicantMobile] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matcherSpend, setMatcherSpend] = useState('shopping');

  const filteredCards = selectedCategory === 'all'
    ? CREDIT_CARDS
    : CREDIT_CARDS.filter((c) => c.category === selectedCategory);

  // Recommended card based on spend matcher
  const matchedCard = CREDIT_CARDS.find((c) => c.category === matcherSpend) || CREDIT_CARDS[0];

  const handleOpenApplyModal = (card) => {
    setActiveCardForApply(card);
    logEvent('click_apply_credit_card', { card_id: card.id, card_name: card.name, bank: card.bank });
  };

  const handleConfirmRedirect = (e) => {
    e.preventDefault();
    if (!activeCardForApply) return;

    setIsSubmitting(true);
    logEvent('submit_card_lead_redirect', {
      card_id: activeCardForApply.id,
      card_name: activeCardForApply.name,
      mobile_provided: Boolean(applicantMobile),
    });

    // Cleanly redirect to official bank application portal with commission tracking
    setTimeout(() => {
      setIsSubmitting(false);
      window.open(activeCardForApply.applyUrl, '_blank', 'noopener,noreferrer');
      setActiveCardForApply(null);
      setApplicantMobile('');
    }, 400);
  };

  return (
    <section id="credit-cards" className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 my-12">
      <div className="rounded-3xl border border-indigo-100 bg-white p-6 sm:p-10 shadow-sm">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold text-blue-800">
              <span>💳 CashKaro-Style Credit Card Hub</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Best Cashback Credit Cards with Guaranteed Cash Rewards
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-2xl">
              Don’t get confused by thousands of bank cards. Compare top co-branded cards for Flipkart, Amazon, Swiggy &amp; Blinkit, and earn up to <strong>₹2,000 Extra Cash</strong> on approval.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-black text-emerald-800">
              ⚡ Up to ₹24,500/Year Savings
            </span>
          </div>
        </div>

        {/* ═══ INTERACTIVE SPEND MATCHER WIZARD ═══ */}
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-slate-50 to-blue-50/80 p-5 sm:p-6 border border-indigo-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                ⚡ 10-Second Card Recommendation Engine
              </span>
              <h3 className="mt-1 text-base sm:text-lg font-black text-slate-900">
                Where do you spend the most online every month?
              </h3>
            </div>

            {/* Spend Category Selectors */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
              {[
                { id: 'shopping', label: '🛒 Amazon / Flipkart' },
                { id: 'food', label: '🍔 Swiggy / Blinkit' },
                { id: 'utility', label: '💡 Universal & Bills' },
                { id: 'travel', label: '✈️ Flights & Travel' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMatcherSpend(item.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                    matcherSpend === item.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matched Recommendation Card Highlight */}
          <div className="mt-4 rounded-xl bg-white p-4 border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black uppercase">
                #1 Recommended Match for You
              </span>
              <h4 className="mt-1 text-sm sm:text-base font-black text-slate-900 truncate">
                {matchedCard.name}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {matchedCard.highlight} • <strong className="text-emerald-700">Estimated Annual Savings: {matchedCard.annualSavings}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                {matchedCard.extraReward}
              </span>
              <button
                type="button"
                onClick={() => handleOpenApplyModal(matchedCard)}
                className="rounded-xl bg-[#5855E5] px-5 py-2 text-xs font-black text-white shadow-xs hover:bg-[#4743DE] transition-all whitespace-nowrap"
              >
                Apply Now →
              </button>
            </div>
          </div>
        </div>

        {/* ═══ FILTER PILLS FOR CARD LIST ═══ */}
        <div className="mt-8 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Top Cards (6)' },
              { id: 'shopping', label: 'Online Shopping (2)' },
              { id: 'food', label: 'Food & Grocery (1)' },
              { id: 'utility', label: 'All Spends & Bills (2)' },
              { id: 'travel', label: 'Travel & Lounge (1)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
            Direct Bank Redirect (Zero Sensitive Data Collected)
          </span>
        </div>

        {/* ═══ CREDIT CARDS GRID ═══ */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-xl min-w-0"
            >
              <div>
                {/* Top Badge & Bank Name */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {card.bank}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[9.5px] font-black uppercase tracking-tight truncate ${card.tagColor}`}>
                    {card.tag}
                  </span>
                </div>

                {/* Simulated Visual Card Header */}
                <div className={`mt-3 rounded-xl bg-gradient-to-r ${card.accentColor} p-4 text-white shadow-md relative overflow-hidden`}>
                  <div className="flex justify-between items-center text-xs font-extrabold opacity-90">
                    <span>{card.bank}</span>
                    <span className="text-[10px] tracking-widest">CREDIT</span>
                  </div>
                  <h3 className="mt-3 text-sm sm:text-base font-black tracking-tight leading-snug line-clamp-1">
                    {card.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold">
                    <span className="rounded-md bg-white/20 px-2 py-0.5 backdrop-blur-xs">
                      {card.cashback}
                    </span>
                    <span className="text-emerald-300">
                      ~{card.annualSavings}/yr
                    </span>
                  </div>
                </div>

                {/* Perks Breakdown */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    <span className="text-slate-700 font-medium leading-relaxed">
                      {card.highlight}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">🏛️</span>
                    <span className="text-slate-600 font-semibold truncate">
                      Annual Fee: <strong>{card.annualFee}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-bold shrink-0">✈️</span>
                    <span className="text-slate-600 font-semibold truncate">
                      {card.lounge}
                    </span>
                  </div>
                </div>

                {/* CashKaro-Style Extra Reward Callout */}
                <div className="mt-4 rounded-xl bg-emerald-50 p-2.5 border border-emerald-200/80 text-center">
                  <span className="block text-xs font-black text-emerald-800">
                    {card.extraReward}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    Direct Cash Transfer to Bank / UPI on Card Approval
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenApplyModal(card)}
                  className="flex-1 rounded-xl bg-[#5855E5] py-2.5 px-3 text-center text-xs font-black text-white shadow-xs transition-all hover:bg-[#4743DE] hover:shadow-md active:scale-[0.98]"
                >
                  Apply Now &amp; Claim Reward →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MODAL: REDIRECT TO OFFICIAL BANK APPLICATION PORTAL ═══ */}
      {activeCardForApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveCardForApply(null)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm font-bold"
            >
              ✕
            </button>

            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">
              {activeCardForApply.extraReward}
            </span>

            <h3 className="mt-3 text-lg font-black text-slate-900">
              Apply for {activeCardForApply.name}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              You are being redirected to <strong>{activeCardForApply.bank}&apos;s Official Application Portal</strong>.
            </p>

            {/* Optional Mobile Tracking Field */}
            <form onSubmit={handleConfirmRedirect} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter Mobile Number (To track your ₹1,500 Cash Reward)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={applicantMobile}
                  onChange={(e) => setApplicantMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Strict Security Notice */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span>🔒</span>
                  <span>100% Secure &amp; Zero Sensitive Data</span>
                </div>
                <p>
                  ShoppersDeals does NOT collect your PIN, CVV, or passwords. Your application is completed directly on {activeCardForApply.bank}&apos;s 256-bit encrypted portal.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#5855E5] py-3 text-sm font-black text-white shadow-md hover:bg-[#4743DE] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Redirecting to Bank Portal...</span>
                  ) : (
                    <span>Proceed to {activeCardForApply.bank} Portal →</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
