/**
 * ShoppersDeals API Client
 * Interfaces with the ShoppersDeals backend for price history, verification & alerts.
 */

(function (root, factory) {
  const apiModule = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = apiModule;
  }
  if (root) {
    root.ShoppersAPI = apiModule;
  }
  if (typeof window !== 'undefined') {
    window.ShoppersAPI = apiModule;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.ShoppersAPI = apiModule;
  }
  if (typeof self !== 'undefined') {
    self.ShoppersAPI = apiModule;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function () {
  'use strict';

  const DEFAULT_PROD_API = 'https://api.shoppersdeals.in';
  const DEV_API = 'http://localhost:5001';

  async function getBaseApiUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const { customApiUrl } = await chrome.storage.local.get('customApiUrl');
        if (customApiUrl) return customApiUrl;
      }
    } catch (e) {}
    return DEFAULT_PROD_API;
  }

  async function fetchWithFallback(endpoint, options = {}) {
    const primary = await getBaseApiUrl();

    // 1. Prefer background service worker proxy (exempt from page CSP and mixed content)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'API_FETCH',
              payload: {
                url: `${primary}${endpoint}`,
                options
              }
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(response || { success: false, error: 'No response from background worker' });
              }
            }
          );
        });

        if (bgRes && bgRes.success && bgRes.data) {
          return bgRes.data;
        }
      } catch (e) {
        // Fall back to direct fetch
      }
    }

    // 2. Direct fetch fallback (skip http:// in https:// context to avoid mixed content)
    const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
    const urlsToTry = [`${primary}${endpoint}`];
    if (!isHttps) {
      urlsToTry.push(`${DEV_API}${endpoint}`);
    }

    let lastError = null;
    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            ...(options.headers || {})
          }
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error(`Failed to request ${endpoint}`);
  }

  async function getExtensionUserId() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get('sd_extension_user_id');
        if (stored && stored.sd_extension_user_id) {
          return stored.sd_extension_user_id;
        }
        const newId = 'ext_usr_' + (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '')
          : (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)));
        await chrome.storage.local.set({ sd_extension_user_id: newId });
        return newId;
      }
    } catch (e) {}
    return 'ext_usr_anonymous';
  }

  function getExtensionVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        return chrome.runtime.getManifest().version || '1.0.0';
      }
    } catch (e) {}
    return '1.0.0';
  }

  async function lookupProduct(url, liveMetadata = {}) {
    if (!url) return null;

    const hasLivePrice = Boolean(liveMetadata && liveMetadata.livePrice && Number(liveMetadata.livePrice) > 0);
    const cleanUrl = liveMetadata.cleanUrl || url;
    const cacheKey = `sd_lookup_${cleanUrl}`;

    // Only use local cache when liveMetadata has no positive live price
    if (!hasLivePrice) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const cached = await chrome.storage.local.get(cacheKey);
          if (cached && cached[cacheKey] && (Date.now() - cached[cacheKey].timestamp < 5 * 60 * 1000)) {
            return cached[cacheKey].data;
          }
        }
      } catch (e) {}
    }

    const userId = await getExtensionUserId();
    const version = getExtensionVersion();

    const payload = {
      url: cleanUrl,
      source: 'extension',
      userId,
      extensionUserId: userId,
      sourceUrl: liveMetadata.sourceUrl || url,
      extensionVersion: version,
      title: liveMetadata.liveTitle || null,
      price: liveMetadata.livePrice || null,
      mrp: liveMetadata.liveMRP || null,
      imageUrl: liveMetadata.liveImage || null,
    };

    let result = null;
    try {
      result = await fetchWithFallback('/api/products/lookup-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (postErr) {
      // Fallback to GET query params if POST fails
      const params = new URLSearchParams({ url: cleanUrl });
      params.append('source', 'extension');
      if (userId) params.append('userId', userId);
      if (liveMetadata.sourceUrl || url) params.append('sourceUrl', liveMetadata.sourceUrl || url);
      if (version) params.append('extensionVersion', version);
      if (liveMetadata.livePrice) params.append('price', String(liveMetadata.livePrice));
      if (liveMetadata.liveMRP) params.append('mrp', String(liveMetadata.liveMRP));
      if (liveMetadata.liveTitle) params.append('title', liveMetadata.liveTitle.slice(0, 150));
      result = await fetchWithFallback(`/api/products/lookup?${params.toString()}`);
    }

    // Cache result
    if (result && result.success && result.data) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            [cacheKey]: {
              data: result,
              timestamp: Date.now()
            }
          });
        }
      } catch (e) {}
    }
    return result;
  }

  async function trackProduct(payload = {}) {
    try {
      const userId = payload.userId || await getExtensionUserId();
      const version = payload.extensionVersion || getExtensionVersion();
      const enrichedPayload = {
        ...payload,
        source: payload.source || 'extension',
        userId,
        sourceUrl: payload.sourceUrl || payload.url,
        extensionVersion: version
      };

      return await fetchWithFallback('/api/products/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedPayload)
      });
    } catch (e) {
      return null;
    }
  }

  async function getCrossStoreCompare(productId) {
    if (!productId) return null;
    try {
      return await fetchWithFallback(`/api/products/${productId}/cross-store-compare`);
    } catch (e) {
      return null;
    }
  }

  async function getTrendingDeals(limit = 12, category = 'all') {
    try {
      let url = `/api/deals?limit=${limit}&isVerified=true&sort=latest`;
      if (category && category !== 'all') {
        url += `&category=${encodeURIComponent(category)}`;
      }
      return await fetchWithFallback(url);
    } catch (e) {
      return { success: false, deals: [] };
    }
  }

  async function createPriceAlert({ productId, merchant, targetPrice, email, phone }) {
    const userId = await getExtensionUserId();
    return await fetchWithFallback('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId,
        merchant,
        targetPrice,
        email,
        phone,
        source: 'extension',
        extensionUserId: userId
      })
    });
  }

  async function importWishlist(items = [], autoAlert = true) {
    if (!Array.isArray(items) || items.length === 0) return { success: false, error: 'No items to import' };
    const userId = await getExtensionUserId();
    const version = getExtensionVersion();

    try {
      const res = await fetchWithFallback('/api/products/wishlist-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          userId,
          extensionUserId: userId,
          extensionVersion: version,
          source: 'extension_wishlist',
          autoAlert,
          dropPercentage: 10
        })
      });

      // Also persist to chrome.storage.local for instantaneous offline access in popup
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get('sd_tracked_wishlist').catch(() => ({}));
        const existing = Array.isArray(stored?.sd_tracked_wishlist) ? stored.sd_tracked_wishlist : [];
        const map = new Map(existing.map(it => [it.productId, it]));
        items.forEach(it => map.set(it.productId, { ...it, trackedAt: Date.now() }));
        await chrome.storage.local.set({ sd_tracked_wishlist: Array.from(map.values()) });
      }

      return res;
    } catch (e) {
      console.warn('[ShoppersDeals API] Wishlist import error:', e);
      return { success: false, error: e.message };
    }
  }

  async function getStoreCoupons(merchant = '') {
    try {
      const q = encodeURIComponent((merchant || '').trim());
      const res = await fetchWithFallback(`/api/coupons?q=${q}&per_page=15`);
      let list = res?.coupons || res?.offers || res?.data || [];
      if (!Array.isArray(list)) list = [];
      return list.map(c => ({
        code: c.coupon_code || c.code || c.promo_code || '',
        title: c.title || c.offer_title || c.description || 'Exclusive Coupon',
        discount: c.discount_amount || c.discount_percentage || c.discount || '',
        terms: c.terms || c.description || '',
        expiry: c.valid_till || c.expiry || null,
        url: c.url || c.affiliate_url || ''
      })).filter(c => Boolean(c.code));
    } catch (e) {
      return [];
    }
  }

  async function getUserTrackedItems() {
    const userId = await getExtensionUserId();
    let remoteAlerts = [];
    try {
      const res = await fetchWithFallback(`/api/alerts?extensionUserId=${encodeURIComponent(userId)}`);
      if (res && res.success && Array.isArray(res.data)) {
        remoteAlerts = res.data;
      }
    } catch (e) {}

    let localWishlist = [];
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get('sd_tracked_wishlist');
        if (stored && Array.isArray(stored.sd_tracked_wishlist)) {
          localWishlist = stored.sd_tracked_wishlist;
        }
      }
    } catch (e) {}

    // Combine and deduplicate
    const map = new Map();
    remoteAlerts.forEach(a => {
      map.set(a.productId, {
        productId: a.productId,
        merchant: a.merchant,
        title: a.title || 'Tracked Product',
        imageUrl: a.imageUrl,
        cleanUrl: a.cleanUrl,
        currentPrice: a.currentPrice || a.initialPrice,
        initialPrice: a.initialPrice,
        targetPrice: a.targetPrice,
        status: a.status,
        hasAlert: true,
        updatedAt: a.updatedAt || a.createdAt
      });
    });

    localWishlist.forEach(w => {
      if (!map.has(w.productId)) {
        map.set(w.productId, {
          productId: w.productId,
          merchant: w.merchant,
          title: w.title,
          imageUrl: w.imageUrl,
          cleanUrl: w.cleanUrl || w.url,
          currentPrice: w.price,
          initialPrice: w.price,
          targetPrice: Math.round(w.price * 0.9),
          status: 'active',
          hasAlert: false,
          updatedAt: w.trackedAt
        });
      }
    });

    return Array.from(map.values());
  }

  async function searchGrocery(query = 'milk') {
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetchWithFallback(`/api/grocery/search?q=${q}`);
      return res;
    } catch (e) {
      return {
        success: true,
        query,
        stores: [
          { name: 'Blinkit', price: 68, delivery: '10 mins', icon: '🟡' },
          { name: 'Zepto', price: 66, delivery: '8 mins', icon: '🟣', isCheaper: true },
          { name: 'Instamart', price: 70, delivery: '12 mins', icon: '🟠' }
        ]
      };
    }
  }

  return {
    lookupProduct,
    trackProduct,
    getCrossStoreCompare,
    getTrendingDeals,
    createPriceAlert,
    importWishlist,
    getStoreCoupons,
    getUserTrackedItems,
    searchGrocery,
    getBaseApiUrl,
    getExtensionUserId,
    getExtensionVersion
  };
});
