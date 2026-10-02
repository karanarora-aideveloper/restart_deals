'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatInr } from '@/lib/affiliate';

export default function VariantSelector({ variantsData, currentProductId, currentProduct }) {
  const router = useRouter();

  if (!variantsData || !variantsData.hasVariants || !Array.isArray(variantsData.variants) || variantsData.variants.length <= 1) {
    return null;
  }

  const { dimensions, variants, seriesName, currentTraits } = variantsData;
  const targetCountry = currentProduct?.country || 'IN';

  const initialVariant = variants.find(
    (v) => String(v._id) === String(currentProductId) || String(v.productId) === String(currentProductId)
  ) || variants[0];

  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [activeStorage, setActiveStorage] = useState(initialVariant?.storage || currentTraits?.storage || null);
  const [activeColor, setActiveColor] = useState(initialVariant?.color || currentTraits?.color || null);
  const [activeShade, setActiveShade] = useState(initialVariant?.shade || currentTraits?.shade || null);
  const [activeSize, setActiveSize] = useState(initialVariant?.size || currentTraits?.size || null);

  useEffect(() => {
    const v = variants.find(
      (item) => String(item._id) === String(currentProductId) || String(item.productId) === String(currentProductId)
    );
    if (v) {
      setSelectedVariant(v);
      if (v.storage) setActiveStorage(v.storage);
      if (v.color) setActiveColor(v.color);
      if (v.shade) setActiveShade(v.shade);
      if (v.size) setActiveSize(v.size);
    }
  }, [currentProductId, variants]);

  // Robust sibling search across multi-attribute dimension matrix
  const findSibling = ({ storage, color, shade, size }) => {
    const targetStorage = storage !== undefined ? storage : activeStorage;
    const targetColor = color !== undefined ? color : activeColor;
    const targetShade = shade !== undefined ? shade : activeShade;
    const targetSize = size !== undefined ? size : activeSize;

    // 1. Exact match across all active target dimensions
    let exact = variants.find((v) => {
      if (targetStorage && v.storage !== targetStorage) return false;
      if (targetColor && (!v.color || v.color.toLowerCase() !== targetColor.toLowerCase())) return false;
      if (targetShade && (!v.shade || v.shade.toLowerCase() !== targetShade.toLowerCase())) return false;
      if (targetSize && (!v.size || v.size.toLowerCase() !== targetSize.toLowerCase())) return false;
      return true;
    });

    if (exact) return exact;

    // 2. Prioritize newly chosen storage
    if (storage) {
      const storageSiblings = variants.filter((v) => v.storage === storage);
      if (storageSiblings.length > 0) {
        if (targetColor) {
          const colorMatch = storageSiblings.find((v) => v.color && v.color.toLowerCase() === targetColor.toLowerCase());
          if (colorMatch) return colorMatch;
        }
        return storageSiblings[0];
      }
    }

    // 3. Prioritize newly chosen color
    if (color) {
      const colorSiblings = variants.filter((v) => v.color && v.color.toLowerCase() === color.toLowerCase());
      if (colorSiblings.length > 0) {
        if (targetStorage) {
          const storageMatch = colorSiblings.find((v) => v.storage === targetStorage);
          if (storageMatch) return storageMatch;
        }
        return colorSiblings[0];
      }
    }

    // 4. Prioritize beauty shade
    if (shade) {
      const shadeMatch = variants.find((v) => v.shade && v.shade.toLowerCase() === shade.toLowerCase());
      if (shadeMatch) return shadeMatch;
    }

    // 5. Prioritize size/pack
    if (size) {
      const sizeMatch = variants.find((v) => v.size && v.size.toLowerCase() === size.toLowerCase());
      if (sizeMatch) return sizeMatch;
    }

    return selectedVariant || initialVariant;
  };

  const handleSelect = (sibling, overrides = {}) => {
    if (!sibling) return;

    const nextStorage = overrides.storage !== undefined ? overrides.storage : (sibling.storage || activeStorage);
    const nextColor = overrides.color !== undefined ? overrides.color : (sibling.color || activeColor);
    const nextShade = overrides.shade !== undefined ? overrides.shade : (sibling.shade || activeShade);
    const nextSize = overrides.size !== undefined ? overrides.size : (sibling.size || activeSize);

    // Instant 0ms visual update
    setActiveStorage(nextStorage);
    setActiveColor(nextColor);
    setActiveShade(nextShade);
    setActiveSize(nextSize);
    setSelectedVariant(sibling);

    // Broadcast live event to update ProductGallery & ProductActions immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sd:variant-selected', { detail: sibling }));
      window.history.replaceState(null, '', `/product/${sibling._id}`);
    }

    if (String(sibling._id) === String(currentProductId)) return;
    router.push(`/product/${sibling._id}`);
  };

  const hasStorage = dimensions?.storages && dimensions.storages.length > 1;
  const hasShades = dimensions?.shades && dimensions.shades.length > 1;
  const hasColors = !hasShades && dimensions?.colors && dimensions.colors.length > 1;
  const hasSizes = dimensions?.sizes && dimensions.sizes.length > 1;

  if (!hasStorage && !hasColors && !hasShades && !hasSizes) {
    return null;
  }

  return (
    <div className="mb-5 rounded-2xl border border-gray-200/90 bg-gradient-to-b from-gray-50/70 to-white p-4 shadow-2xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">✨</span>
          <span className="text-xs font-black uppercase tracking-wider text-gray-700">
            Series Options
          </span>
        </div>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand">
          {variants.length} Variants
        </span>
      </div>

      {/* 1. Storage Options (e.g. 256GB vs 512GB) */}
      {hasStorage && (
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-bold text-gray-700">Storage</span>
            <span className="text-[11px] font-extrabold text-brand">{activeStorage || 'Select'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dimensions.storages.map((stg) => {
              const targetSibling = findSibling({ storage: stg });
              const isSelected = activeStorage === stg;
              const priceText = targetSibling?.price ? formatInr(targetSibling.price, targetCountry) : null;

              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => handleSelect(targetSibling, { storage: stg })}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-brand bg-brand text-white shadow-xs scale-[1.02]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{stg}</span>
                  {priceText && (
                    <span
                      className={`text-[10px] font-semibold ${
                        isSelected ? 'text-white/90' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    >
                      {priceText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Color Swatches (Laptops, Mobiles) */}
      {hasColors && (
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-bold text-gray-700">Color</span>
            <span className="text-[11px] font-extrabold text-gray-900">{activeColor || 'Select'}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {dimensions.colors.map((clr) => {
              const targetSibling = findSibling({ color: clr.name });
              const isSelected = activeColor && activeColor.toLowerCase() === clr.name.toLowerCase();

              return (
                <button
                  key={clr.name}
                  type="button"
                  title={`${clr.name} (${formatInr(clr.cheapestPrice, targetCountry)})`}
                  onClick={() => handleSelect(targetSibling, { color: clr.name })}
                  className={`group relative flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-brand bg-white text-gray-900 ring-2 ring-brand/30 shadow-xs scale-[1.02]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-2xs"
                    style={{ backgroundColor: clr.hex || '#E2E4E5' }}
                  />
                  <span>{clr.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Beauty Shades (Cosmetics & Foundations) */}
      {hasShades && (
        <div className="mb-3.5">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-bold text-gray-700">Shade</span>
            <span className="text-[11px] font-extrabold text-pink-600">{activeShade || 'Select'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dimensions.shades.map((shd) => {
              const targetSibling = findSibling({ shade: shd.name });
              const isSelected = activeShade && activeShade.toLowerCase() === shd.name.toLowerCase();
              const priceText = shd.cheapestPrice ? formatInr(shd.cheapestPrice, targetCountry) : null;

              return (
                <button
                  key={shd.name}
                  type="button"
                  onClick={() => handleSelect(targetSibling, { shade: shd.name })}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-pink-500 bg-pink-50/60 text-gray-900 ring-1 ring-pink-500 shadow-2xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: shd.hex || '#FCD34D' }}
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-[11px] leading-tight text-gray-900">{shd.name}</div>
                    {priceText && (
                      <div className="text-[10px] font-black text-brand leading-none mt-0.5">{priceText}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Sizes & Volumes (e.g. 18ml vs 30ml) */}
      {hasSizes && (
        <div className="mb-1">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-bold text-gray-700">Pack / Volume</span>
            <span className="text-[11px] font-extrabold text-brand">{activeSize || 'Select'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dimensions.sizes.map((sz) => {
              const targetSibling = findSibling({ size: sz });
              const isSelected = activeSize === sz;
              const priceText = targetSibling?.price ? formatInr(targetSibling.price, targetCountry) : null;

              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSelect(targetSibling, { size: sz })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-brand bg-brand text-white shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{sz}</span>
                  {priceText && (
                    <span
                      className={`text-[10px] font-semibold ${
                        isSelected ? 'text-white/90' : 'text-gray-400'
                      }`}
                    >
                      {priceText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Live Selected Sibling Summary */}
      {selectedVariant && (
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-emerald-600 font-bold">✓</span>
            <span className="font-extrabold text-gray-800 truncate text-[11.5px]">
              {[selectedVariant.color, selectedVariant.storage, selectedVariant.shade, selectedVariant.size].filter(Boolean).join(' · ') || selectedVariant.title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black text-brand text-[12px]">
              {formatInr(selectedVariant.price, targetCountry)}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${selectedVariant.inStock ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {selectedVariant.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
