'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getSavedDeals } from '@/lib/savedDeals';
import { SAVED_CHANGED_EVENT } from '@/lib/useSavedCount';
import { isUsableImageUrl } from '@/lib/affiliate';
import { trackWishlistShare } from '@/lib/analytics';
import DealCard from '@/components/DealCard';

export default function SavedPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [savedDeals, setSavedDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const authUser = user && token ? { ...user, token } : null;
      const list = await getSavedDeals(authUser);
      if (!cancelled) {
        setSavedDeals(list);
        setLoading(false);
      }
    };
    load();
    window.addEventListener(SAVED_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(SAVED_CHANGED_EVENT, load);
    };
  }, [user, token]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  // A saved deal with no image, or one whose image fails to actually load, is dropped from
  // view entirely rather than shown without a photo — matching the native app's behavior.
  const visibleDeals = savedDeals.filter((d) => isUsableImageUrl(d.imageUrl));
  const handleImageUnavailable = (id) => {
    setSavedDeals((prev) => prev.filter((d) => (d._id || d.id) !== id));
  };

  if (visibleDeals.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4ed] text-3xl">
          🔖
        </div>
        <h1 className="mb-2 text-xl font-extrabold text-[#1a1a1a]">No Saved Deals Yet</h1>
        <p className="mb-6 max-w-sm text-sm leading-6 text-[#6b7280]">
          Tap the heart icon on any deal to save it here for later.
        </p>

        {!user && (
          <div className="mb-6 w-full rounded-2xl border border-[#efefef] bg-white p-5 text-left shadow-sm">
            <p className="mb-2 text-sm font-bold text-[#1a1a1a]">✨ Want your wishlist on every device?</p>
            <p className="mb-4 text-xs leading-5 text-[#6b7280]">
              Sign in with Google in one click to sync your saved deals seamlessly across your phone, tablet, and laptop.
            </p>
            <Link href="/profile" className="block rounded-xl bg-brand py-2.5 text-center text-xs font-bold text-white">
              Sign In to Sync
            </Link>
          </div>
        )}

        <Link href="/" className="rounded-xl border border-[#e5e7eb] bg-white px-6 py-2.5 text-sm font-bold text-[#1a1a1a] shadow-sm hover:border-brand">
          Explore Live Deals →
        </Link>
      </div>
    );
  }

  const totalCartValue = visibleDeals.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
  const totalOriginalValue = visibleDeals.reduce((sum, d) => sum + (Number(d.originalPrice || d.previousPrice) || Number(d.price) || 0), 0);
  const totalSavings = Math.max(0, totalOriginalValue - totalCartValue);

  const handleShareWishlist = () => {
    trackWishlistShare(visibleDeals.length, totalCartValue, totalSavings);
    const text = `🛍️ My Universal Wishlist on ShoppersDeals (${visibleDeals.length} items, Total Savings ₹${totalSavings.toLocaleString('en-IN')})! Check live prices:`;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator?.share) {
      navigator.share({ title: 'My Wishlist | ShoppersDeals', text, url }).catch(() => {});
    } else if (navigator?.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        alert('Wishlist link copied to clipboard!');
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] md:px-8 pb-16">
      {/* Universal Wishlist Hero Banner */}
      <div className="mx-3 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-gray-200/80 bg-white p-5 md:p-6 shadow-xs md:mx-0">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-100/70 px-3 py-1 text-xs font-black text-brand mb-2">
            <span>❤️</span>
            <span>OneList — Cross-Store Price Tracker</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Your Universal Wishlist
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            {user ? 'Synced with your account' : 'Saved on this browser'} — All your saved items from Amazon, Flipkart, Myntra &amp; more in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Savings</span>
              <p className="text-base font-black text-emerald-900">
                ₹{totalSavings.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="border-l border-emerald-300 pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Items</span>
              <p className="text-base font-black text-emerald-900">{visibleDeals.length}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShareWishlist}
            className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-extrabold text-gray-800 shadow-2xs hover:border-brand hover:text-brand transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>Share Wishlist</span>
          </button>
        </div>
      </div>

      {!user && (
        <div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#fed7aa] bg-[#fffaf5] px-4 py-3 md:mx-0">
          <p className="text-xs text-[#9a3412]">
            <span className="font-bold">Guest Mode:</span> Deals saved on this device only.{' '}
            <Link href="/profile" className="font-semibold underline hover:text-[#7c2d12]">Sign in with Google to sync across all devices</Link>.
          </p>
        </div>
      )}

      <div className="px-3 pt-4 md:px-0 flex items-center justify-between text-xs text-gray-500">
        <span>Continuous automated price verification active on all saved products.</span>
        <Link href="/" className="font-bold text-brand hover:underline">
          + Save more deals →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3 sm:gap-4 md:grid-cols-3 md:gap-5 md:p-0 md:pt-4 lg:grid-cols-4 xl:grid-cols-5">
        {visibleDeals.map((deal) => (
          <DealCard
            key={deal._id || deal.id}
            deal={deal}
            savedDeals={savedDeals}
            onSavedChange={setSavedDeals}
            onImageUnavailable={handleImageUnavailable}
          />
        ))}
      </div>
    </div>
  );
}
