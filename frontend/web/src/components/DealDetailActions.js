'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAffiliateUrl } from '@/lib/affiliate';
import { logEvent } from '@/lib/analytics';
import { saveDealItem, isDealSaved, getSavedDeals } from '@/lib/savedDeals';
import { emitSavedChanged } from '@/lib/useSavedCount';

export default function DealDetailActions({ deal, merchant }) {
  const { user, token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dealId = deal._id || deal.id;

  useEffect(() => {
    const authUser = user && token ? { ...user, token } : null;
    getSavedDeals(authUser).then((list) => setSaved(isDealSaved(dealId, list)));
  }, [user, token, dealId]);

  const handleToggleSave = async () => {
    setSaving(true);
    const authUser = user && token ? { ...user, token } : null;
    const updated = await saveDealItem(deal, authUser);
    setSaving(false);
    setSaved(isDealSaved(dealId, updated));
    emitSavedChanged();
  };

  return (
    <div className="flex items-center gap-3">
      <a
        href={getAffiliateUrl(deal.dealUrl)}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => logEvent('click_deal', { item_id: dealId, item_name: deal.title })}
        style={{ backgroundColor: merchant.btnColor, color: merchant.textColor }}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold"
      >
        Get Deal Now
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={merchant.textColor} strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
      </a>
      <button
        type="button"
        onClick={handleToggleSave}
        disabled={saving}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? '#ff3f6c' : 'none'} stroke={saved ? '#ff3f6c' : '#333'} strokeWidth="2">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>
    </div>
  );
}
