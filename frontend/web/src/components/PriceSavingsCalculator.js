'use client';

import React, { useState } from 'react';
import { formatInr } from '@/lib/affiliate';
import PriceAlertModal from './PriceAlertModal';

export default function PriceSavingsCalculator({ product, priceStats }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentPrice = Number(product?.price) || 0;
  const lowestPrice = Number(priceStats?.lowestPrice) || currentPrice;
  const averagePrice = Number(priceStats?.averagePrice) || currentPrice;
  const potentialSavings = currentPrice > lowestPrice ? currentPrice - lowestPrice : 0;
  const savingsPct = currentPrice > 0 && potentialSavings > 0 ? Math.round((potentialSavings / currentPrice) * 100) : 0;

  if (potentialSavings <= 0) return null;

  return (
    <>
      <div className="mt-8 rounded-2xl border border-[#fed7aa] bg-gradient-to-r from-[#fffaf5] to-[#fff7ed] p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ea580c] text-white text-xs font-black">
                {(product?.country || 'IN').toUpperCase() === 'US' ? '$' : '₹'}
              </span>
              <h3 className="text-sm font-extrabold text-[#9a3412]">
                Potential Extra Savings: {formatInr(potentialSavings, product?.country)} ({savingsPct}% Off)
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#7c2d12]">
              This product was recorded at a low of <span className="font-bold">{formatInr(lowestPrice, product?.country)}</span>. You can save an extra {formatInr(potentialSavings, product?.country)} if you wait for the next price drop.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 rounded-xl bg-[#ea580c] px-4 py-2.5 text-xs font-black text-white shadow-xs transition-opacity hover:opacity-90"
          >
            🔔 Alert Me at {formatInr(lowestPrice, product?.country)}
          </button>
        </div>
      </div>

      <PriceAlertModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
