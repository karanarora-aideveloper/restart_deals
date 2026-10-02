'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getSavedDeals } from '@/lib/savedDeals';

export const SAVED_CHANGED_EVENT = 'sd:saved-changed';

// Small client-only store for the wishlist badge count shown in the header/tab bar.
// Re-reads on the custom `sd:saved-changed` event that DealCard fires after a toggle,
// so the badge stays in sync without a global state library.
export function useSavedCount() {
  const { user, token } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const authUser = user && token ? { ...user, token } : null;
    const list = await getSavedDeals(authUser);
    setCount(Array.isArray(list) ? list.length : 0);
  }, [user, token]);

  useEffect(() => {
    refresh();
    window.addEventListener(SAVED_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SAVED_CHANGED_EVENT, refresh);
  }, [refresh]);

  return count;
}

export function emitSavedChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SAVED_CHANGED_EVENT));
  }
}
