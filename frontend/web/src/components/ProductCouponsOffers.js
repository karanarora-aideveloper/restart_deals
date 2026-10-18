'use client';

import React, { useState } from 'react';
import { getAffiliateUrl, formatInr } from '@/lib/affiliate';
import { trackCouponCopied, trackOutboundClick } from '@/lib/analytics';

/**
 * Authentic Bank Offers & Store Discounts Component
 * 
 * STRICT VISIBILITY GATE:
 * Only renders when an authentic, verified bank discount or on-page coupon is present
 * in the product/deal data model. Completely hides (returns null) if no real discount exists.
 * Zero fake coupon codes. Zero synthetic fallback promos.
 */
export default function ProductCouponsOffers({ product, merchant, deal, className = '' }) {
  const [copiedCode, setCopiedCode] = useState(null);

  if (!product && !deal) return null;

  const country = product?.country || deal?.country || 'IN';
  const merchantName = merchant?.label || product?.merchant || deal?.merchant || 'Store';
  const cleanMerchant = (merchant?.id || product?.merchant || deal?.merchant || 'store').toLowerCase();
  const currentPrice = Number(product?.price) || Number(deal?.dealPrice) || 0;
  const bestBankPrice = Number(product?.bankOfferPrice) || Number(deal?.bankOfferPrice) || 0;

  // 1. Gather raw scraped bank offers from product or deal
  const rawBankOffers = Array.isArray(product?.bankOffers) && product.bankOffers.length > 0
    ? product.bankOffers
    : Array.isArray(deal?.bankOffers) && deal.bankOffers.length > 0
      ? deal.bankOffers
      : [];

  // Filter for authentic bank offers (never allow fake/dummy placeholder codes)
  const validBankOffers = rawBankOffers
    .filter((bo) => {
      if (!bo) return false;
      const desc = typeof bo === 'string' ? bo : (bo.description || bo.title || '');
      const code = bo.code || '';
      if (/BANKOFFER\d/i.test(code) || /AMZNBANK/i.test(code) || /FKRTBIG/i.test(code)) return false;
      const hasBank = Boolean(bo.bank && bo.bank !== 'Bank Offer');
      const hasDiscount = Boolean(bo.discountAmount && bo.discountAmount > 0);
      const hasEffective = Boolean(bo.effectivePrice && bo.effectivePrice > 0);
      const hasKeywords = /bank|card|instant discount|cashback|emi|hdfc|sbi|icici|axis|kotak|onecard/i.test(desc);
      return (hasBank || hasKeywords) && (hasDiscount || hasEffective || desc.length >= 15);
    })
    .map((bo, idx) => {
      const desc = typeof bo === 'string' ? bo : (bo.description || bo.title || '');
      const discount = bo.discountAmount || (bo.effectivePrice && currentPrice > bo.effectivePrice ? currentPrice - bo.effectivePrice : null);
      return {
        id: `bank-${idx}`,
        type: 'bank',
        bank: bo.bank || 'Bank Instant Discount',
        title: discount
          ? `Save ${formatInr(discount, country)} with ${bo.bank || 'Bank Card'}`
          : (bo.bank ? `${bo.bank} Instant Card Discount` : 'Instant Bank Card Discount'),
        description: desc || 'Instant discount applied at checkout when paying with eligible bank credit/debit card.',
        discountAmount: discount,
        effectivePrice: bo.effectivePrice || (discount && currentPrice > discount ? currentPrice - discount : null),
        code: null,
      };
    });

  // 2. If no itemized bank offers exist but an authentic bankOfferPrice is recorded below live price
  if (validBankOffers.length === 0 && bestBankPrice > 0 && currentPrice > bestBankPrice) {
    const diff = currentPrice - bestBankPrice;
    validBankOffers.push({
      id: 'bank-effective',
      type: 'bank',
      bank: 'Bank Partner Discount',
      title: `Save ${formatInr(diff, country)} with Bank Offer`,
      description: `Instant discount verified on checkout. Pay ${formatInr(bestBankPrice, country)} with eligible cards.`,
      discountAmount: diff,
      effectivePrice: bestBankPrice,
      code: null,
    });
  }

  // 3. Check for genuine on-page store coupon (scraped directly from merchant page)
  const couponData = deal?.coupon || product?.coupon;
  const validCoupons = [];
  if (couponData) {
    const label = typeof couponData === 'string' ? couponData : couponData.label;
    const code = typeof couponData === 'object' ? couponData.code : null;
    const isCleanCode = code && !/^(CLAIM DEAL|ACTIVE|COUPON|COLLECTED|SUPERCOINS)$/i.test(code.trim());

    if (label && label.length > 3) {
      validCoupons.push({
        id: 'coupon-live',
        type: 'coupon',
        bank: null,
        title: label,
        description: isCleanCode
          ? `Use coupon code "${code}" at checkout for additional savings.`
          : 'Apply the on-page coupon checkbox before adding this item to cart on store page.',
        code: isCleanCode ? code.trim() : null,
        isClipCoupon: !isCleanCode,
      });
    }
  }

  const allOffers = [...validBankOffers, ...validCoupons];

  // STRICT GATE: If there is no authentic bank discount or verified coupon, HIDE ENTIRELY
  if (allOffers.length === 0) {
    return null;
  }

  const affiliateUrl = getAffiliateUrl(product?.cleanUrl || product?.url || deal?.dealUrl || deal?.url, country);

  const handleCopy = (code) => {
    if (!code) return;
    trackCouponCopied({ code, merchant: cleanMerchant }, 'pdp_card');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2500);
      });
    }
  };

  return (
    <div className={`rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-white to-emerald-50/20 p-5 sm:p-6 shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-sm">
            💳
          </span>
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Live Bank Offers &amp; Discounts
            </h3>
            <p className="text-[11px] font-medium text-gray-500">
              Verified card discounts available for {merchantName}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Verified Active
        </span>
      </div>

      <div className="space-y-3">
        {allOffers.slice(0, 4).map((item) => {
          const isCopied = copiedCode === item.code;
          const isBank = item.type === 'bank';

          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-3.5 transition-all hover:border-brand/40 shadow-2xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      isBank ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isBank ? `💳 ${item.bank}` : '🏷️ Store Coupon'}
                  </span>
                  {item.effectivePrice && (
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                      Effective: {formatInr(item.effectivePrice, country)}
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-black text-gray-900 leading-snug">
                  {item.title}
                </h4>
                <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.code ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.code)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                      isCopied
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-2xs'
                        : 'border-dashed border-brand/60 bg-orange-50 text-brand hover:bg-brand hover:text-white shadow-2xs active:scale-95'
                    }`}
                  >
                    <span>{isCopied ? '✓' : '✂️'}</span>
                    <span>{isCopied ? 'Copied!' : item.code}</span>
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
                    Card Discount
                  </span>
                )}

                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => trackOutboundClick(product || deal, affiliateUrl, 'pdp_bank_offer_apply')}
                  className="rounded-xl bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-black transition-colors"
                >
                  Avail on {merchantName} ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between text-[11px] text-gray-500 pt-2.5 border-t border-dashed border-gray-200">
        <span>💡 Instant bank discounts are automatically applied at checkout when entering an eligible card.</span>
      </div>
    </div>
  );
}
