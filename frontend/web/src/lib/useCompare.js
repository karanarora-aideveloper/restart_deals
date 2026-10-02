'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getDetailedProductType, isSameSubcategory } from '@/lib/specExtractor';

const STORAGE_KEY = 'SD_COMPARE_PRODUCTS_LIST';
const MAX_COMPARE_ITEMS = 4;

const CompareContext = createContext({
  compareItems: [],
  activeComparisonType: null,
  activeComparisonTypeLabel: '',
  activeQueryKeywords: '',
  addToCompare: () => {},
  removeFromCompare: () => {},
  toggleCompare: () => {},
  isInCompare: () => false,
  clearCompare: () => {},
  isMaxReached: false,
});

export function CompareProvider({ children }) {
  const [compareItems, setCompareItems] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [pendingMismatch, setPendingMismatch] = useState(null); // { product, currentLabel, newLabel, currentCount }

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCompareItems(parsed.slice(0, MAX_COMPARE_ITEMS));
        }
      }
    } catch (err) {
      console.error('Failed to load compare items from localStorage:', err);
    }
  }, []);

  const saveToStorage = useCallback((items) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('sd-compare-changed', { detail: items }));
    } catch (err) {
      console.error('Failed to save compare items to localStorage:', err);
    }
  }, []);

  const activeTypeInfo = useMemo(() => {
    if (!compareItems || compareItems.length === 0) {
      return { slug: null, label: '', queryKeywords: '' };
    }
    return getDetailedProductType(compareItems[0]);
  }, [compareItems]);

  const activeComparisonType = activeTypeInfo.slug;
  const activeComparisonTypeLabel = activeTypeInfo.label;
  const activeQueryKeywords = activeTypeInfo.queryKeywords;

  const removeFromCompare = useCallback((id) => {
    if (!id) return;
    const targetId = String(id);
    setCompareItems((prev) => {
      const next = prev.filter((p) => String(p._id || p.productId || p.id) !== targetId);
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const isInCompare = useCallback((id) => {
    if (!id) return false;
    const targetId = String(id);
    return compareItems.some((p) => String(p._id || p.productId || p.id) === targetId);
  }, [compareItems]);

  const addToCompare = useCallback((product, options = {}) => {
    if (!product) return;
    const { forceReplace = false } = options;
    const prodId = String(product._id || product.productId || product.id);

    setCompareItems((prev) => {
      if (prev.some((p) => String(p._id || p.productId || p.id) === prodId)) {
        return prev;
      }

      // Check strict niche compatibility (Water Purifier vs Water Purifier only, Refrigerator vs Refrigerator only)
      if (prev.length > 0 && !forceReplace) {
        const firstItem = prev[0];
        if (!isSameSubcategory(firstItem, product)) {
          const currentType = getDetailedProductType(firstItem);
          const newType = getDetailedProductType(product);

          // Trigger mismatch confirmation modal
          setPendingMismatch({
            product,
            currentLabel: currentType.label,
            newLabel: newType.label,
            currentCount: prev.length,
          });
          return prev;
        }
      }

      if (forceReplace) {
        const next = [product];
        saveToStorage(next);
        return next;
      }

      if (prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }

      const next = [...prev, product];
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const toggleCompare = useCallback((product) => {
    if (!product) return;
    const prodId = String(product._id || product.productId || product.id);
    if (isInCompare(prodId)) {
      removeFromCompare(prodId);
    } else {
      addToCompare(product);
    }
  }, [isInCompare, removeFromCompare, addToCompare]);

  const clearCompare = useCallback(() => {
    setCompareItems([]);
    saveToStorage([]);
    setPendingMismatch(null);
  }, [saveToStorage]);

  const handleConfirmSwitch = () => {
    if (pendingMismatch && pendingMismatch.product) {
      addToCompare(pendingMismatch.product, { forceReplace: true });
    }
    setPendingMismatch(null);
  };

  const handleCancelMismatch = () => {
    setPendingMismatch(null);
  };

  return (
    <CompareContext.Provider
      value={{
        compareItems: mounted ? compareItems : [],
        activeComparisonType,
        activeComparisonTypeLabel,
        activeQueryKeywords,
        activeSubcategory: activeComparisonType,
        activeSubcategoryLabel: activeComparisonTypeLabel,
        addToCompare,
        removeFromCompare,
        toggleCompare,
        isInCompare,
        clearCompare,
        isMaxReached: compareItems.length >= MAX_COMPARE_ITEMS,
      }}
    >
      {children}

      {/* Strict Niche Mismatch Confirmation Modal */}
      {pendingMismatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="flex max-w-md flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h3 className="mt-4 text-base font-extrabold text-gray-900">
              Compare Same Product Niche Only
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-gray-600">
              You are currently comparing <span className="font-bold text-gray-900">{pendingMismatch.currentLabel}</span> ({pendingMismatch.currentCount} product{pendingMismatch.currentCount > 1 ? 's' : ''}).
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Side-by-side spec comparison is only supported for products of the exact same type (e.g. Water Purifier vs Water Purifier only). Would you like to clear your current comparison and start comparing <span className="font-bold text-brand">{pendingMismatch.newLabel}</span> instead?
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={handleCancelMismatch}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Keep Current
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white shadow-md hover:brightness-110 active:scale-95 transition-all"
              >
                <span>Switch to {pendingMismatch.newLabel}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
