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

  async function getTrendingDeals(limit = 8) {
    try {
      return await fetchWithFallback(`/api/deals?limit=${limit}&isVerified=true`);
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

  return {
    lookupProduct,
    trackProduct,
    getCrossStoreCompare,
    getTrendingDeals,
    createPriceAlert,
    getBaseApiUrl,
    getExtensionUserId,
    getExtensionVersion
  };
});
