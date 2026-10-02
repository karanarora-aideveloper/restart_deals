/**
 * Thin wrapper over gtag — mirrors the native app's src/utils/analytics.js so event names
 * (add_to_wishlist, click_deal, select_item, search, view_item_list, login) stay identical
 * across web and native, keeping GA4 reporting unified.
 */
export function logEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}
