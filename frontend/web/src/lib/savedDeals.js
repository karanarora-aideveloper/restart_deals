'use client';

import { API_BASE_URL } from './config';

const SAVED_DEALS_KEY = '@shoppers_deals_saved_deals_v1';

// ─── Local storage helpers ───────────────────────────────────────────────────

function getLocalSaved() {
  if (typeof window === 'undefined') return [];
  try {
    const data = window.localStorage.getItem(SAVED_DEALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalSaved(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

// ─── API helpers (signed-in sync) ────────────────────────────────────────────

async function fetchSavedFromAPI(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/saved-deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return res.ok && json.success ? json.data || [] : null;
  } catch {
    return null;
  }
}

async function toggleSavedOnAPI(dealId, token) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/saved-deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dealId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return null;
    // The toggle endpoint only confirms { saved, savedDealsCount } — it doesn't return the
    // populated deal objects needed to render cards — so fetch the authoritative list right
    // after. Without this, the heart icon / wishlist count would revert to empty immediately
    // after every save, only correcting itself whenever something else happened to refetch.
    return await fetchSavedFromAPI(token);
  } catch {
    return null;
  }
}

export function isDealSaved(dealId, savedList) {
  if (!dealId || !Array.isArray(savedList)) return false;
  return savedList.some((d) => (d._id || d.id) === dealId);
}

// authUser: { token, ...userFields } | null
export async function getSavedDeals(authUser) {
  if (authUser?.token) {
    const apiSaved = await fetchSavedFromAPI(authUser.token);
    if (apiSaved) return apiSaved;
  }
  return getLocalSaved();
}

export async function saveDealItem(deal, authUser) {
  const dealId = deal._id || deal.id;

  if (authUser?.token) {
    const updated = await toggleSavedOnAPI(dealId, authUser.token);
    if (updated) return updated;
  }

  const current = getLocalSaved();
  const alreadySaved = isDealSaved(dealId, current);
  const updated = alreadySaved
    ? current.filter((d) => (d._id || d.id) !== dealId)
    : [deal, ...current];
  setLocalSaved(updated);
  return updated;
}
