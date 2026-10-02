'use client';

import React from 'react';
import { formatInr } from '@/lib/affiliate';

/**
 * PriceBarometer: Visual Truth Engine for Deal Authenticity
 * 
 * Accurately plots current selling price against tracked historical extremes:
 * [Lowest: ₹X] ━━━━━●━━━━━ [Highest: ₹Y]
 * Displays Truth Badges separating real price drops from inflated MRP illusions.
 */
export default function PriceBarometer({ product, priceStats }) {
  if (!product) return null;

  const country = product.country || 'IN';
  const currentPrice = Number(product.price ?? product.dealPrice) || 0;
  const lowestPrice = Number(priceStats?.lowestPrice) || currentPrice;
  const highestPrice = Number(priceStats?.highestPrice) || currentPrice;
  const averagePrice = Number(priceStats?.averagePrice) || currentPrice;
  const previousPrice = Number(product.previousPrice ?? priceStats?.previousPrice) || 0;
  const originalPrice = Number(product.originalPrice ?? priceStats?.originalPrice) || 0;

  const realPriceDrop = priceStats?.realPriceDrop || (previousPrice > currentPrice ? previousPrice - currentPrice : 0);
  const realPriceDropPct = priceStats?.realPriceDropPct || (previousPrice > currentPrice ? Math.round(((previousPrice - currentPrice) / previousPrice) * 100) : 0);
  const isAllTimeLow = priceStats?.isAllTimeLow || (lowestPrice > 0 && currentPrice <= lowestPrice * 1.01 && (priceStats?.totalPricePoints || 0) >= 2);
  const isFakeMrpDiscount = priceStats?.isFakeMrpDiscount;

  // Calculate position % on barometer (clamped 0 to 100)
  let positionPct = 50;
  if (highestPrice > lowestPrice) {
    positionPct = Math.min(100, Math.max(0, Math.round(((currentPrice - lowestPrice) / (highestPrice - lowestPrice)) * 100)));
  } else {
    positionPct = 50;
  }

  // Barometer color based on position
  let barColor = 'bg-emerald-500';
  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (positionPct <= 25) {
    barColor = 'bg-emerald-500';
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (positionPct <= 60) {
    barColor = 'bg-blue-500';
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (positionPct <= 85) {
    barColor = 'bg-amber-500';
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
  } else {
    barColor = 'bg-rose-500';
    badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <div className="rounded-2xl border border-gray-200/90 bg-white p-4.5 shadow-2xs">
      {/* Header with Authenticity Verdict */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🎯</span>
          <span className="text-xs font-black uppercase tracking-wider text-gray-800">
            Price Barometer & Truth Check
          </span>
        </div>

        {/* Truth Badges */}
        {isAllTimeLow ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-300">
            🔥 All-Time Lowest Price Ever
          </span>
        ) : realPriceDrop > 0 && realPriceDropPct >= 3 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 border border-emerald-200">
            📉 Genuine Drop: {formatInr(realPriceDrop, country)} ({realPriceDropPct}% off)
          </span>
        ) : isFakeMrpDiscount ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-300">
            ⚠️ Everyday Price · Inflated MRP
          </span>
        ) : currentPrice < averagePrice ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700 border border-blue-200">
            ✓ {formatInr(averagePrice - currentPrice, country)} Below 30-Day Avg
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-extrabold text-gray-700">
            ⚖️ Normal Selling Range
          </span>
        )}
      </div>

      {/* Visual Barometer Track */}
      <div className="relative my-4">
        {/* Track Line */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400" />

        {/* Marker Indicator */}
        <div
          className="absolute -top-1.5 flex flex-col items-center transition-all duration-300"
          style={{ left: `calc(${positionPct}% - 8px)` }}
        >
          <div className={`h-5 w-5 rounded-full border-2 border-white shadow-md ${barColor}`} />
        </div>
      </div>

      {/* Axis Labels: Lowest, Average, Highest */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <div>
          <span className="block text-[10px] uppercase font-bold text-emerald-700">Lowest Ever</span>
          <span className="font-extrabold text-gray-900">{formatInr(lowestPrice, country)}</span>
        </div>

        {averagePrice > 0 && (
          <div className="text-center">
            <span className="block text-[10px] uppercase font-bold text-gray-500">30-Day Avg</span>
            <span className="font-extrabold text-gray-800">{formatInr(averagePrice, country)}</span>
          </div>
        )}

        <div className="text-right">
          <span className="block text-[10px] uppercase font-bold text-rose-700">Highest Recorded</span>
          <span className="font-extrabold text-gray-900">{formatInr(highestPrice, country)}</span>
        </div>
      </div>

      {/* Price Truth Breakdown Box */}
      <div className="mt-3.5 rounded-xl bg-gray-50/80 p-3 text-xs leading-relaxed text-gray-600 border border-gray-100">
        {previousPrice && previousPrice > currentPrice ? (
          <div className="flex items-start gap-2 text-emerald-800 font-medium">
            <span className="mt-0.5 font-bold">✓</span>
            <span>
              <strong>Authentic Price Drop:</strong> Dropped from <span className="font-bold line-through text-gray-500">{formatInr(previousPrice, country)}</span> to{' '}
              <span className="font-extrabold text-emerald-700">{formatInr(currentPrice, country)}</span> today. True savings: <span className="font-black text-emerald-700">{formatInr(realPriceDrop, country)} ({realPriceDropPct}%)</span>.
            </span>
          </div>
        ) : isFakeMrpDiscount ? (
          <div className="flex items-start gap-2 text-amber-800 font-medium">
            <span className="mt-0.5 font-bold">⚠️</span>
            <span>
              <strong>MRP Reality Check:</strong> The printed MRP of <span className="line-through">{formatInr(originalPrice, country)}</span> is marketing list price. In reality, this item sells regularly around {formatInr(averagePrice, country)}.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-gray-700 font-medium">
            <span className="mt-0.5 font-bold">ℹ️</span>
            <span>
              <strong>Price Intelligence:</strong> Tracked across {priceStats?.totalPricePoints || 1} price points. Verified directly against real checkout prices, not inflated MRP.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
