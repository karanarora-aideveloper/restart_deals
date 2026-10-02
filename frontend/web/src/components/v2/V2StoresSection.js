'use client';

import React from 'react';
import { renderStoreLogo } from './BrandAndStoreLogos';

const STORES = [
  {
    id: 'amazon',
    name: 'Amazon India',
    tagline: 'Great Indian Festival',
    discount: 'Up to 80% Off',
    badge: 'Verified Deals',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    borderHover: 'hover:border-amber-400 hover:shadow-amber-100',
    bgGradient: 'from-amber-500/10 via-amber-50/40 to-white',
    popularIn: 'Electronics, Mobiles, Pantry',
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    tagline: 'Big Billion Days',
    discount: 'Up to 85% Off',
    badge: 'Assured Loot',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    borderHover: 'hover:border-blue-400 hover:shadow-blue-100',
    bgGradient: 'from-blue-500/10 via-blue-50/40 to-white',
    popularIn: 'Smartphones, TVs, Laptops',
  },
  {
    id: 'myntra',
    name: 'Myntra',
    tagline: 'Fashion Carnival',
    discount: 'Min. 50%–80% Off',
    badge: '100% Original',
    badgeColor: 'bg-pink-100 text-pink-800 border-pink-300',
    borderHover: 'hover:border-pink-400 hover:shadow-pink-100',
    bgGradient: 'from-pink-500/10 via-pink-50/40 to-white',
    popularIn: 'Sneakers, Clothing, Watches',
  },
  {
    id: 'nykaa',
    name: 'Nykaa',
    tagline: 'Beauty Mega Sale',
    discount: 'Up to 60% Off',
    badge: 'Authentic Beauty',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    borderHover: 'hover:border-rose-400 hover:shadow-rose-100',
    bgGradient: 'from-rose-500/10 via-rose-50/40 to-white',
    popularIn: 'Makeup, Skincare, Fragrances',
  },
  {
    id: 'ajio',
    name: 'Ajio',
    tagline: 'All Stars Sale',
    discount: 'Min. 60% Off',
    badge: 'Trendy Loot',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    borderHover: 'hover:border-amber-500 hover:shadow-amber-100',
    bgGradient: 'from-amber-600/10 via-amber-50/40 to-white',
    popularIn: 'Streetwear, Jackets, Footwear',
  },
  {
    id: 'meesho',
    name: 'Meesho',
    tagline: 'Maha Indian Price Drop',
    discount: 'Starting ₹99',
    badge: 'Budget King',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    borderHover: 'hover:border-purple-400 hover:shadow-purple-100',
    bgGradient: 'from-purple-500/10 via-purple-50/40 to-white',
    popularIn: 'Home Essentials, Kitchen, Ethnic',
  },
];

export default function V2StoresSection({ activeMerchant = 'all', onSelectMerchant }) {
  return (
    <section className="w-full border-b border-slate-200/80 bg-white py-10">
      <div className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-brand" />
              <span className="text-[11px] font-black uppercase tracking-wider text-brand">
                Multi-Store Network
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Deals by Stores
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Filter real-time price drops verified across India&apos;s leading e-commerce platforms.
            </p>
          </div>

          {activeMerchant !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectMerchant?.('all')}
              className="self-start sm:self-auto text-xs font-bold text-brand hover:underline flex items-center gap-1"
            >
              <span>✕ Clear store filter</span>
            </button>
          )}
        </div>

        {/* Store Cards Grid with Official Logos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
          {STORES.map((s) => {
            const isSelected = activeMerchant.toLowerCase() === s.id;
            return (
              <div
                key={s.id}
                onClick={() => onSelectMerchant?.(isSelected ? 'all' : s.id)}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-200 bg-gradient-to-b ${s.bgGradient} ${
                  isSelected
                    ? 'border-brand ring-2 ring-brand/30 shadow-md scale-[1.02]'
                    : 'border-slate-200 hover:shadow-lg hover:-translate-y-1 ' + s.borderHover
                }`}
              >
                {/* Official Store Logo & Badge */}
                <div className="flex items-center justify-between gap-1 mb-3.5">
                  <div className="h-6 flex items-center">
                    {renderStoreLogo(s.id, 'h-5 max-w-[85px] object-contain')}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                </div>

                {/* Store Name & Discount */}
                <h3 className="text-sm font-black text-slate-900 group-hover:text-brand transition-colors">
                  {s.name}
                </h3>
                <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                  {s.discount}
                </p>

                {/* Popular categories */}
                <p className="mt-2 text-[10px] text-slate-500 font-medium line-clamp-1">
                  {s.popularIn}
                </p>

                {/* Action arrow */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-extrabold text-slate-700 group-hover:text-brand">
                  <span>{isSelected ? '✓ Filtering' : 'View Deals'}</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
