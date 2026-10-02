import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

const SAVED_DEALS_KEY = '@shoppers_deals_saved_deals_v1';
// In-memory fallback
let memoryStorage = [];

// ─── Local Storage Helpers ──────────────────────────────────────────────────

const getLocalSaved = async () => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(SAVED_DEALS_KEY);
      return data ? JSON.parse(data) : [];
    }
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      const jsonValue = await AsyncStorage.getItem(SAVED_DEALS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : memoryStorage;
    }
    return memoryStorage;
  } catch (e) {
    return memoryStorage;
  }
};

const setLocalSaved = async (list) => {
  try {
    memoryStorage = list;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(list));
    } else if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    // Silently fail
  }
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

const fetchSavedFromAPI = async (token) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/saved-deals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return json.data || [];
    }
    return null;
  } catch (e) {
    return null;
  }
};

const toggleSavedOnAPI = async (dealId, token) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/saved-deals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dealId }),
    });
    const json = await res.json();
    return res.ok && json.success ? json : null;
  } catch (e) {
    return null;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get saved deals.
 * - Logged-in user: fetch from DB (and cache locally).
 * - Guest: load from device storage.
 * @param {Object} user - User object with token field, or null for guest
 */
export const getSavedDeals = async (user = null) => {
  if (user && user.token) {
    const apiDeals = await fetchSavedFromAPI(user.token);
    if (apiDeals !== null) {
      await setLocalSaved(apiDeals);
      return apiDeals;
    }
    // API failed, fall back to local cache
  }
  return getLocalSaved();
};

/**
 * Toggle save/unsave a deal.
 * - Logged-in user: sync to DB + update local cache.
 * - Guest: device-only storage.
 * @param {Object} deal - Deal object
 * @param {Object} user - User object with token field, or null for guest
 */
export const saveDealItem = async (deal, user = null) => {
  const dealId = deal._id || deal.id;

  if (user && user.token && dealId) {
    const apiResult = await toggleSavedOnAPI(dealId, user.token);
    if (apiResult !== null) {
      // Refetch full list from DB to stay in sync
      const fresh = await fetchSavedFromAPI(user.token);
      const updatedList = fresh !== null ? fresh : await getLocalSaved();
      await setLocalSaved(updatedList);
      return updatedList;
    }
    // API failed, fall through to local-only
  }

  // Guest or API failure: local toggle only
  const list = await getLocalSaved();
  const exists = list.some((d) => (d._id || d.id) === dealId);
  const updatedList = exists
    ? list.filter((d) => (d._id || d.id) !== dealId)
    : [deal, ...list];

  await setLocalSaved(updatedList);
  return updatedList;
};

/**
 * Check if a deal is saved in a list.
 */
export const isDealSaved = (dealId, savedList = []) => {
  if (!dealId || !Array.isArray(savedList)) return false;
  return savedList.some((d) => (d._id || d.id) === dealId);
};
