'use client';

import React, { useState } from 'react';
import { isUsableImageUrl, getOptimizedImageUrl, getImageSrcSet } from '@/lib/affiliate';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';

export default function ProductGallery({ product, latestDeal, merchant }) {
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images.filter(isUsableImageUrl)
    : isUsableImageUrl(product?.imageUrl)
      ? [product.imageUrl]
      : [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customVariantImage, setCustomVariantImage] = useState(null);

  React.useEffect(() => {
    const handleVariantChanged = (e) => {
      const v = e.detail;
      if (v?.imageUrl && isUsableImageUrl(v.imageUrl)) {
        setCustomVariantImage(v.imageUrl);
      }
    };
    window.addEventListener('sd:variant-selected', handleVariantChanged);
    return () => window.removeEventListener('sd:variant-selected', handleVariantChanged);
  }, []);

  const rawActiveImage = customVariantImage || images[selectedIndex] || product?.imageUrl;
  const activeImageHd = getOptimizedImageUrl(rawActiveImage, 'hd');
  const activeImageSrcSet = getImageSrcSet(rawActiveImage);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Main Showcase Container */}
      <div className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md md:aspect-[4/3]">
        {/* Deal Tag / Trend Pill */}
        {latestDeal ? (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border border-red-200 bg-red-500/90 px-3 py-1 text-xs font-extrabold text-white shadow-sm backdrop-blur-md">
            <span>🔥</span>
            <span>JUST DROPPED{latestDeal.discountPercentage ? ` • ${latestDeal.discountPercentage}% OFF` : ''}</span>
          </div>
        ) : (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border border-gray-200/60 bg-white/85 px-3 py-1 text-[11px] font-extrabold text-gray-700 shadow-2xs backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>TRACKED ITEM</span>
          </div>
        )}

        {/* Store Icon Pill with Logo & HD Badge */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md">
            HD 1500p
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-white/95 px-3 py-1.5 shadow-xs backdrop-blur-md">
            {renderStoreLogo(product?.merchant || merchant?.id, 'h-4 w-auto object-contain')}
          </div>
        </div>

        {/* Hero Image */}
        {isUsableImageUrl(rawActiveImage) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImageHd}
            srcSet={activeImageSrcSet}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
            alt={product?.title || 'Product image'}
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="7" width="16" height="13" rx="1.5" />
              <path d="M8 7V5a4 4 0 0 1 8 0v2" />
            </svg>
            <span className="mt-2 text-xs font-semibold">Image Coming Soon</span>
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedIndex(idx);
                setCustomVariantImage(null);
              }}
              className={`relative h-18 w-18 shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-1.5 transition-all ${
                selectedIndex === idx && !customVariantImage
                  ? 'border-brand shadow-sm ring-2 ring-brand/20'
                  : 'border-gray-200 hover:border-gray-300 opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getOptimizedImageUrl(img, 'card')}
                alt={`Thumbnail ${idx + 1}`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
