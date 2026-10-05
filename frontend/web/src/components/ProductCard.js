'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCompare } from '@/lib/useCompare';
import { getAffiliateUrl, getMerchantInfo, formatInr, isUsableImageUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';

export default function ProductCard({ product, onImageUnavailable }) {
  const [imgError, setImgError] = useState(false);
  const { isInCompare, toggleCompare } = useCompare();

  const productId = String(product._id || product.productId);
  const productCountry = product.country || 'IN';
  const merchant = getMerchantInfo(product.merchant);
  const priceDisplay = formatInr(product.price, productCountry) || 'N/A';
  const origPriceDisplay = product.originalPrice ? formatInr(product.originalPrice, productCountry) : null;
  const savings = product.originalPrice && product.price ? product.originalPrice - product.price : null;
  const discountPct = savings && product.originalPrice ? Math.round((savings / product.originalPrice) * 100) : null;
  const isUs = productCountry.toUpperCase() === 'US';
  const timeDisplay = product.priceUpdatedAt
    ? `${new Date(product.priceUpdatedAt).toLocaleDateString(isUs ? 'en-US' : 'en-IN', { day: 'numeric', month: 'short', timeZone: isUs ? 'America/New_York' : 'Asia/Kolkata' })} · ${new Date(product.priceUpdatedAt).toLocaleTimeString(isUs ? 'en-US' : 'en-IN', { hour: '2-digit', minute: '2-digit', timeZone: isUs ? 'America/New_York' : 'Asia/Kolkata' })}`
    : 'Recently checked';

  return (
    <article className="sd-grid-card flex flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white">
      <div className="relative block aspect-square w-full bg-[#fafafa]">
        <Link href={`/product/${productId}`} className="absolute inset-0">
          {isUsableImageUrl(product.imageUrl) && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title || 'Product image'}
              onError={() => {
                setImgError(true);
                onImageUnavailable?.(productId);
              }}
              className="sd-grid-image absolute inset-0 m-auto h-[78%] w-[78%] object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#d4d4d4]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="7" width="16" height="13" rx="1.5" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></svg>
            </div>
          )}
        </Link>

        {discountPct > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-[#1a1a1a] px-2 py-1 text-[10.5px] font-extrabold text-white">
            {discountPct}% OFF
          </span>
        )}

        {/* Compare Button */}
        <button
          type="button"
          aria-label={isInCompare(productId) ? 'Remove from comparison' : 'Add to comparison'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCompare(product);
          }}
          className={`absolute right-2.5 top-2.5 z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-all ${
            isInCompare(productId) ? 'bg-brand text-white' : 'bg-white text-[#4b5563] hover:text-[#111]'
          }`}
          title={isInCompare(productId) ? 'Remove from comparison' : 'Compare product'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col p-[13px]">
        <div className="mb-1.5 flex items-center shrink-0">
          {renderStoreLogo(product.merchant || merchant.id || merchant.label, 'h-3.5 w-auto object-contain')}
        </div>

        <Link href={`/product/${productId}`}>
          <h3 className="sd-line-clamp-2 mb-1.5 min-h-[36px] text-[13.5px] font-bold leading-[18px] text-[#1a1a1a]">
            {product.title || 'Product Item'}
          </h3>
        </Link>

        {product.isSeriesCard && product.seriesVariantCount > 1 ? (
          <div className="mb-2">
            <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10.5px] font-extrabold text-brand">
              <span>✨</span>
              <span>{product.seriesVariantCount} Variants</span>
              {product.seriesStorages?.length > 0 && (
                <span className="font-semibold text-gray-700">({product.seriesStorages.slice(0, 2).join(', ')})</span>
              )}
              {product.seriesColors?.length > 0 && (
                <span className="font-semibold text-gray-600">· {product.seriesColors.length} Colors</span>
              )}
              {product.seriesShades?.length > 0 && (
                <span className="font-semibold text-gray-600">· {product.seriesShades.length} Shades</span>
              )}
            </span>
          </div>
        ) : product.variant?.display ? (
          <div className="mb-2">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-600">
              {product.variant.display}
            </span>
          </div>
        ) : null}

        <div className="mb-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[17px] font-black text-[#1a1a1a]">
            {product.isSeriesCard && product.seriesVariantCount > 1 ? `From ${priceDisplay}` : priceDisplay}
          </span>
          {origPriceDisplay && <span className="text-xs text-[#aaa] line-through">{origPriceDisplay}</span>}
          {discountPct > 0 && <span className="text-xs font-extrabold text-[#e11d48]">{discountPct}% off</span>}
        </div>

        <p className="mb-2.5 hidden items-center gap-1 text-[11px] text-[#aaa] sm:flex">🕒 {timeDisplay}</p>

        {product.isSeriesCard && product.seriesVariantCount > 1 ? (
          <Link
            href={`/product/${productId}`}
            className="mt-auto flex items-center justify-center rounded-lg border border-brand bg-brand/5 py-2.5 text-[11.5px] font-extrabold text-brand transition-colors hover:bg-brand hover:text-white tracking-wide shadow-2xs"
          >
            View {product.seriesVariantCount} Options →
          </Link>
        ) : (
          <a
            href={getAffiliateUrl(product.cleanUrl, productCountry)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => logEvent('click_deal', { item_id: product._id || product.productId, item_name: product.title })}
            style={{ backgroundColor: merchant.btnColor, color: merchant.textColor || '#ffffff' }}
            className="mt-auto flex items-center justify-center rounded-lg py-2.5 text-[11.5px] font-extrabold tracking-wide"
          >
            View on {(product.merchant || 'Store').split('.')[0]}
          </a>
        )}
      </div>
    </article>
  );
}
