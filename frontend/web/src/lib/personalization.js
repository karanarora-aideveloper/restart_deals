/**
 * ShoppersDeals Smart Personalization Engine (sd_pzn)
 * Zero-Database-Overhead, Privacy-First, SSR-Compatible Personalization Vector
 *
 * Stores lightweight behavioral affinity in a compact client/server cookie:
 * - Category affinities (c)
 * - Merchant / Store loyalty (s)
 * - Implicit budget tier (b)
 * - Bank card preferences (cd)
 * - Recently inspected deals / products (r)
 * - Timestamp with automatic 3-day half-life decay (t)
 */

export const PZN_COOKIE_NAME = 'sd_pzn';
export const PZN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
export const PZN_EVENT_NAME = 'sd_pzn_updated';

// Budget tiers based on transaction sweet spot
export const BUDGET_TIERS = {
  1: { label: 'Value / Loot Hunter', min: 0, max: 999 },
  2: { label: 'Mid-Range Shopper', min: 1000, max: 9999 },
  3: { label: 'Upper-Mid / Tech', min: 10000, max: 29999 },
  4: { label: 'Premium / Flagship', min: 30000, max: Infinity },
};

export function calculateBudgetTier(price) {
  const p = Number(price);
  if (!p || isNaN(p) || p <= 0) return 0;
  if (p < 1000) return 1;
  if (p < 10000) return 2;
  if (p < 30000) return 3;
  return 4;
}

const DEFAULT_PROFILE = {
  v: 1,
  c: {},      // { categoryId: score }
  s: {},      // { merchantId: score }
  b: 0,       // budget tier (1-4)
  cd: [],     // ['hdfc', 'sbi', 'icici', 'axis']
  r: [],      // ['PID1', 'PID2', ...] (max 8)
  t: 0,       // last update epoch ms
  hasHistory: false,
};

/**
 * Safely parse cookie string into structured profile
 */
export function parsePersonalizationCookie(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return { ...DEFAULT_PROFILE };
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_PROFILE };
    }

    const categories = parsed.c && typeof parsed.c === 'object' ? parsed.c : {};
    const stores = parsed.s && typeof parsed.s === 'object' ? parsed.s : {};
    const hasHistory = Object.keys(categories).length > 0 || (Array.isArray(parsed.r) && parsed.r.length > 0);

    const profile = {
      v: parsed.v || 1,
      c: categories,
      s: stores,
      b: Number(parsed.b) || 0,
      cd: Array.isArray(parsed.cd) ? parsed.cd.slice(0, 6) : [],
      r: Array.isArray(parsed.r) ? parsed.r.slice(0, 8) : [],
      t: Number(parsed.t) || Date.now(),
      hasHistory,
    };

    return applyTimeDecay(profile);
  } catch (err) {
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Serializes profile into ultra-compact, URL-safe JSON
 */
export function serializePersonalizationCookie(profile) {
  if (!profile || typeof profile !== 'object') return '';

  // Keep top 6 categories to guarantee cookie remains < 300 bytes
  const sortedCategories = Object.entries(profile.c || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const compactC = Object.fromEntries(sortedCategories);

  // Keep top 4 stores
  const sortedStores = Object.entries(profile.s || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const compactS = Object.fromEntries(sortedStores);

  const clean = {
    v: 1,
    c: compactC,
    s: compactS,
    b: Number(profile.b) || 0,
    cd: Array.isArray(profile.cd) ? profile.cd.slice(0, 6) : [],
    r: Array.isArray(profile.r) ? profile.r.slice(0, 8) : [],
    t: Number(profile.t) || Date.now(),
  };

  return encodeURIComponent(JSON.stringify(clean));
}

/**
 * Applies 3-day exponential time decay to older affinities
 * Ensures temporary bursts (e.g. buying a microwave) naturally fade
 */
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export function applyTimeDecay(profile) {
  if (!profile || !profile.t) return profile;
  const now = Date.now();
  const elapsed = now - profile.t;
  if (elapsed < THREE_DAYS_MS) return profile;

  const intervals = Math.min(10, Math.floor(elapsed / THREE_DAYS_MS));
  const decayFactor = Math.pow(0.8, intervals); // 20% decay per 3-day window

  const decayedC = {};
  for (const [k, v] of Object.entries(profile.c || {})) {
    const newVal = Math.round(v * decayFactor * 10) / 10;
    if (newVal >= 0.5) decayedC[k] = newVal;
  }

  const decayedS = {};
  for (const [k, v] of Object.entries(profile.s || {})) {
    const newVal = Math.round(v * decayFactor * 10) / 10;
    if (newVal >= 0.5) decayedS[k] = newVal;
  }

  return {
    ...profile,
    c: decayedC,
    s: decayedS,
    t: now,
  };
}

/**
 * Ingests an interaction event and computes updated profile
 * Action weights:
 * - 'buy_click': +5 points (Affiliate checkout intent)
 * - 'scan_check': +4 points (Price Tracker URL inspection)
 * - 'graph_view': +3 points (90-day price history check)
 * - 'wishlist': +3 points (Saved to wishlist)
 * - 'filter_click': +1 point (Category / Store browse)
 */
export function recordInteraction(currentProfile, action) {
  const profile = currentProfile ? { ...currentProfile } : { ...DEFAULT_PROFILE };
  profile.c = { ...(profile.c || {}) };
  profile.s = { ...(profile.s || {}) };
  profile.r = Array.isArray(profile.r) ? [...profile.r] : [];
  profile.cd = Array.isArray(profile.cd) ? [...profile.cd] : [];

  const weight =
    action.type === 'buy_click' ? 5 :
    action.type === 'scan_check' ? 4 :
    action.type === 'graph_view' ? 3 :
    action.type === 'wishlist' ? 3 :
    action.type === 'filter_click' ? 1 : 2;

  // 1. Update Category Affinity
  if (action.category && action.category !== 'all') {
    const cat = String(action.category).toLowerCase().trim();
    profile.c[cat] = Math.min(50, (profile.c[cat] || 0) + weight);
  }

  // 2. Update Merchant Affinity
  if (action.merchant && action.merchant !== 'all') {
    const store = String(action.merchant).toLowerCase().trim();
    profile.s[store] = Math.min(40, (profile.s[store] || 0) + weight);
  }

  // 3. Update Budget Tier (Moving Average)
  if (action.price && Number(action.price) > 0) {
    const itemTier = calculateBudgetTier(action.price);
    if (itemTier > 0) {
      profile.b = profile.b ? Math.round(profile.b * 0.6 + itemTier * 0.4) : itemTier;
    }
  }

  // 4. Update Bank Cards if provided
  if (action.card) {
    const cardCode = String(action.card).toLowerCase().trim();
    if (!profile.cd.includes(cardCode)) {
      profile.cd = [cardCode, ...profile.cd].slice(0, 5);
    }
  }

  // 5. Update Recently Viewed / Interacted Products
  const prodId = action.productId || action.dealId;
  if (prodId) {
    const strId = String(prodId).trim();
    profile.r = [strId, ...profile.r.filter((id) => id !== strId)].slice(0, 8);
  }

  profile.t = Date.now();
  profile.hasHistory = true;

  return profile;
}

/**
 * Client-side helper to record interaction directly in browser document.cookie
 */
export function recordClientInteraction(action) {
  if (typeof document === 'undefined') return;

  try {
    const cookies = document.cookie.split(';').map((c) => c.trim());
    const match = cookies.find((c) => c.startsWith(`${PZN_COOKIE_NAME}=`));
    const rawVal = match ? match.slice(`${PZN_COOKIE_NAME}=`.length) : '';

    const currentProfile = parsePersonalizationCookie(rawVal);
    const updated = recordInteraction(currentProfile, action);
    const serialized = serializePersonalizationCookie(updated);

    document.cookie = `${PZN_COOKIE_NAME}=${serialized}; path=/; max-age=${PZN_COOKIE_MAX_AGE}; SameSite=Lax`;

    // Dispatch event so reactive UI (recent strip, category pills) can re-render smoothly
    window.dispatchEvent(new CustomEvent(PZN_EVENT_NAME, { detail: updated }));
    return updated;
  } catch (e) {
    console.warn('[Personalization] Failed to record client interaction:', e);
  }
}

/**
 * Client-side helper to toggle/set a preferred bank card
 */
export function setClientPreferredCard(cardCode) {
  if (typeof document === 'undefined' || !cardCode) return;
  try {
    const cookies = document.cookie.split(';').map((c) => c.trim());
    const match = cookies.find((c) => c.startsWith(`${PZN_COOKIE_NAME}=`));
    const rawVal = match ? match.slice(`${PZN_COOKIE_NAME}=`.length) : '';

    const currentProfile = parsePersonalizationCookie(rawVal);
    const code = String(cardCode).toLowerCase().trim();
    let cards = currentProfile.cd || [];

    if (cards.includes(code)) {
      cards = cards.filter((c) => c !== code);
    } else {
      cards = [code, ...cards].slice(0, 5);
    }

    currentProfile.cd = cards;
    currentProfile.t = Date.now();
    const serialized = serializePersonalizationCookie(currentProfile);

    document.cookie = `${PZN_COOKIE_NAME}=${serialized}; path=/; max-age=${PZN_COOKIE_MAX_AGE}; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent(PZN_EVENT_NAME, { detail: currentProfile }));
    return currentProfile;
  } catch (e) {}
}

const RECENT_CARDS_STORAGE_KEY = '@sd_recent_cards_v1';

export function saveRecentViewedCard(cardData) {
  if (typeof window === 'undefined' || !cardData?.id) return;
  try {
    const raw = window.localStorage.getItem(RECENT_CARDS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((item) => item.id !== cardData.id);
    const updated = [
      {
        id: cardData.id,
        title: cardData.title || '',
        price: cardData.price || 0,
        originalPrice: cardData.originalPrice || 0,
        discountPercentage: cardData.discountPercentage || 0,
        merchant: cardData.merchant || 'amazon',
        imageUrl: cardData.imageUrl || '',
        href: cardData.href || `/product/${cardData.id}`,
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, 8);
    window.localStorage.setItem(RECENT_CARDS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function getRecentViewedCards() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CARDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearRecentViewedCards() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RECENT_CARDS_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Client-side helper to clear/reset all personalization cookies (User Privacy Control)
 */
export function clearClientPersonalization() {
  if (typeof document === 'undefined') return;
  document.cookie = `${PZN_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  clearRecentViewedCards();
  window.dispatchEvent(new CustomEvent(PZN_EVENT_NAME, { detail: { ...DEFAULT_PROFILE } }));
}

/**
 * Algorithmic Blended Re-ranking for SSR Feed
 * Combines:
 * - Freshness (time decay)
 * - True Price Drop & Discount %
 * - Category Affinity
 * - Store Loyalty
 * - Budget Tier Match
 * Preserves 70/30 exploration/exploitation ratio to avoid filter bubbles.
 */
export function scoreAndSortDeals(deals, profile) {
  if (!Array.isArray(deals) || deals.length <= 1) return deals;
  if (!profile || !profile.hasHistory) return deals;

  const now = Date.now();
  const topCategories = Object.entries(profile.c || {})
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
  const primaryCat = topCategories[0] || null;
  const secondaryCat = topCategories[1] || null;

  const topStores = Object.entries(profile.s || {})
    .sort((a, b) => b[1] - a[1])
    .map(([store]) => store);
  const preferredStore = topStores[0] || null;

  const userTier = profile.b || 0;

  // 1. Compute scores for each deal
  const scored = deals.map((deal, originalIdx) => {
    const dealTime = new Date(deal.createdAt || deal.postedAt || deal.updatedAt || deal.lastVerifiedAt || 0).getTime();
    const ageHours = Math.max(0, (now - dealTime) / (1000 * 60 * 60));

    // Freshness: 100 points for brand new, decays by 2.5 pts/hour
    const freshnessScore = Math.max(10, 100 - ageHours * 2.5);

    // Discount & Drop Cash Score: 0 to 100
    const discountPct = Number(deal.discountPercentage || 0);
    const dropCash = Number(deal.priceDropCash || 0);
    const discountScore = Math.min(100, discountPct + (dropCash > 500 ? 15 : dropCash > 200 ? 8 : 0));

    // Baseline Quality Score (50% Freshness + 50% Deal Depth)
    const baseScore = freshnessScore * 0.5 + discountScore * 0.5;

    // Personalization Boosts:
    let boost = 0;
    const dealCat = String(deal.category || '').toLowerCase();
    const dealSub = String(deal.subcategory || '').toLowerCase();
    const dealMerchant = String(deal.merchant || '').toLowerCase();
    const dealTier = calculateBudgetTier(deal.dealPrice || deal.price);

    // Category affinity: Primary (+25%), Secondary (+15%)
    if (primaryCat && (dealCat.includes(primaryCat) || dealSub.includes(primaryCat))) {
      boost += 28;
    } else if (secondaryCat && (dealCat.includes(secondaryCat) || dealSub.includes(secondaryCat))) {
      boost += 16;
    }

    // Store loyalty (+10%)
    if (preferredStore && dealMerchant.includes(preferredStore)) {
      boost += 12;
    }

    // Budget tier match (+12%)
    if (userTier > 0 && dealTier === userTier) {
      boost += 14;
    }

    const finalScore = baseScore + boost;

    return {
      deal,
      finalScore,
      originalIdx,
      isExploration: !boost, // candidate for 70/30 serendipity injection
    };
  });

  // 2. Sort primarily by finalScore descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // 3. Apply 70/30 Exploration-Exploitation Serendipity Guard:
  // Every 4th item (indices 3, 7, 11...), if an exceptional high-discount deal from an
  // unvisited category is available further down the feed, pull it up to stimulate discovery.
  const result = [];
  const pool = [...scored];
  let position = 0;

  while (pool.length > 0) {
    if (position > 0 && position % 4 === 3) {
      // Find the highest-scoring serendipitous item (unexplored category or massive discount)
      const serendipityIdx = pool.findIndex((item) => item.isExploration && (item.deal.discountPercentage >= 40 || item.deal.priceDropCash >= 500));
      if (serendipityIdx !== -1) {
        result.push(pool.splice(serendipityIdx, 1)[0].deal);
        position++;
        continue;
      }
    }

    // Otherwise pop the highest affinity item
    result.push(pool.shift().deal);
    position++;
  }

  return result;
}
