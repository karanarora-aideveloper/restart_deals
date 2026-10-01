/**
 * ShoppersDeals Background Service Worker (Manifest V3)
 * Manages tab state, extension badges, caching and alarms.
 */

// Periodic background alarm for housekeeping
chrome.alarms.create('sd_housekeeping', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sd_housekeeping') {
    await pruneExpiredCache();
  }
});

async function pruneExpiredCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const keysToRemove = [];

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('sd_lookup_') && value && value.timestamp) {
        if (now - value.timestamp > 24 * 60 * 60 * 1000) {
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`[ShoppersDeals SW] Pruned ${keysToRemove.length} expired cache keys.`);
    }
  } catch (e) {
    console.warn('[ShoppersDeals SW] Prune cache failed:', e);
  }
}

// Tab change listener to clear badge if navigating away from product
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab?.url) {
    const isStore = /amazon\.in|flipkart\.com|myntra\.com|nykaa\.com|ajio\.com/i.test(tab.url);
    if (!isStore) {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});

// Initialize unique anonymous installation ID
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const { sd_extension_user_id } = await chrome.storage.local.get('sd_extension_user_id');
    if (!sd_extension_user_id) {
      const newId = 'ext_usr_' + (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)));
      await chrome.storage.local.set({ sd_extension_user_id: newId });
      console.log('[ShoppersDeals SW] Initialized unique extension client ID:', newId);
    }
  } catch (e) {}
});

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRODUCT_DETECTED') {
    (async () => {
      try {
        const tabId = sender.tab?.id;
        if (tabId) {
          await chrome.action.setBadgeText({ tabId, text: '✓' });
          await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
        }

        // Fire-and-forget background tracking sync to guarantee MongoDB record
        const payload = message.payload;
        if (payload && (payload.cleanUrl || payload.sourceUrl)) {
          const stored = await chrome.storage.local.get('customApiUrl').catch(() => ({}));
          const apiBase = stored?.customApiUrl || 'https://api.shoppersdeals.in';
          fetch(`${apiBase}/api/products/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: payload.cleanUrl || payload.sourceUrl,
              title: payload.title,
              price: payload.price,
              mrp: payload.mrp,
              imageUrl: payload.imageUrl,
              source: 'extension',
              userId: payload.userId,
              sourceUrl: payload.sourceUrl,
              extensionVersion: chrome.runtime.getManifest()?.version || '1.0.0',
            })
          }).catch(() => {});
        }

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_TAB_URL') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ url: activeTab?.url || null });
      } catch (err) {
        sendResponse({ url: null, error: err.message });
      }
    })();
    return true;
  }

  // Proxy network requests through service worker to bypass page CSP & mixed content
  if (message.type === 'API_FETCH') {
    (async () => {
      try {
        const { url, options = {} } = message.payload || {};
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            ...(options.headers || {})
          }
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          sendResponse({ success: false, status: res.status, error: `HTTP ${res.status}` });
          return;
        }

        const data = await res.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
