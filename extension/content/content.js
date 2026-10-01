/**
 * ShoppersDeals Content Script
 * Detects supported e-commerce product pages, coordinates API lookup & injects tracker.
 */

(function () {
  'use strict';

  let lastUrl = window.location.href;
  let isChecking = false;

  async function checkAndInject() {
    if (isChecking) return;
    isChecking = true;

    try {
      let liveDetails = ShoppersParser.extractLivePageDetails();
      if (!liveDetails || !liveDetails.productId) {
        isChecking = false;
        return;
      }

      // If price is not yet rendered on dynamically hydrated pages (e.g. Amazon twister or SPA), retry once after 500ms
      if (!liveDetails.livePrice) {
        await new Promise(r => setTimeout(r, 500));
        const retryDetails = ShoppersParser.extractLivePageDetails();
        if (retryDetails && retryDetails.livePrice) {
          liveDetails = retryDetails;
        }
      }

      const currentUrl = window.location.href;
      liveDetails.sourceUrl = currentUrl;

      // Safely access ShoppersAPI across global contexts
      const api = (typeof ShoppersAPI !== 'undefined')
        ? ShoppersAPI
        : (typeof window !== 'undefined' && window.ShoppersAPI)
          ? window.ShoppersAPI
          : (typeof globalThis !== 'undefined' && globalThis.ShoppersAPI)
            ? globalThis.ShoppersAPI
            : null;

      let userId = 'ext_usr_anonymous';
      if (api && typeof api.getExtensionUserId === 'function') {
        try {
          userId = await api.getExtensionUserId();
        } catch (e) {}
      }

      console.log('[ShoppersDeals] Product page detected:', liveDetails.merchant, liveDetails.productId, 'User:', userId);

      // Notify background service worker with complete attribution
      try {
        chrome.runtime.sendMessage({
          type: 'PRODUCT_DETECTED',
          payload: {
            merchant: liveDetails.merchant,
            productId: liveDetails.productId,
            cleanUrl: liveDetails.cleanUrl,
            sourceUrl: currentUrl,
            source: 'extension',
            userId: userId,
            title: liveDetails.liveTitle,
            price: liveDetails.livePrice,
            mrp: liveDetails.liveMRP,
            imageUrl: liveDetails.liveImage
          }
        });
      } catch (e) {}

      // 1. Optimistic Immediate Render: Show the widget in 0ms using live DOM data!
      let productData = {
        productId: liveDetails.productId,
        merchant: liveDetails.merchant,
        title: liveDetails.liveTitle || document.title,
        price: liveDetails.livePrice,
        originalPrice: liveDetails.liveMRP || liveDetails.livePrice,
        isNew: true,
        priceHistory: liveDetails.livePrice ? [{
          price: liveDetails.livePrice,
          originalPrice: liveDetails.liveMRP,
          timestamp: new Date()
        }] : [],
        priceStats: {
          lowestPrice: liveDetails.livePrice,
          highestPrice: liveDetails.liveMRP || liveDetails.livePrice,
          averagePrice: liveDetails.livePrice,
          currentPrice: liveDetails.livePrice
        }
      };

      // Injects into Shadow DOM immediately so user NEVER waits or sees a blank page!
      ShoppersInjector.renderWidget(productData, liveDetails, null, true);

      // 2. Asynchronous Background Enrichment: Fetch full historical DB checkpoints & cross-store compare
      (async () => {
        try {
          if (!api || typeof api.lookupProduct !== 'function') return;
          const lookupRes = await api.lookupProduct(liveDetails.cleanUrl || window.location.href, liveDetails);
          if (lookupRes && lookupRes.success && lookupRes.data) {
            productData = lookupRes.data;

            // Authoritative live page data MUST take precedence over stale DB values!
            if (liveDetails.livePrice) {
              productData.price = liveDetails.livePrice;
            }
            if (liveDetails.liveMRP) {
              productData.originalPrice = liveDetails.liveMRP;
            }
            if (liveDetails.liveTitle && (!productData.title || productData.title.length < liveDetails.liveTitle.length)) {
              productData.title = liveDetails.liveTitle;
            }
            if (liveDetails.liveImage && !productData.imageUrl) {
              productData.imageUrl = liveDetails.liveImage;
            }

            // Ensure priceHistory is populated and ends with today's live price
            if (!Array.isArray(productData.priceHistory)) productData.priceHistory = [];
            if (liveDetails.livePrice) {
              const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
              const todayIdx = productData.priceHistory.findIndex(h => {
                if (h.date === todayStr) return true;
                if (h.timestamp) {
                  return new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
                }
                return false;
              });
              if (todayIdx >= 0) {
                productData.priceHistory[todayIdx].price = liveDetails.livePrice;
                if (liveDetails.liveMRP) productData.priceHistory[todayIdx].originalPrice = liveDetails.liveMRP;
                productData.priceHistory[todayIdx].timestamp = new Date();
              } else {
                productData.priceHistory.push({
                  date: todayStr,
                  price: liveDetails.livePrice,
                  originalPrice: liveDetails.liveMRP || productData.originalPrice || liveDetails.livePrice,
                  timestamp: new Date()
                });
              }
            }

            // Recalculate price stats with authoritative live price
            if (productData.priceStats) {
              productData.priceStats.currentPrice = productData.price;
              if (!productData.priceStats.lowestPrice || productData.price < productData.priceStats.lowestPrice) {
                productData.priceStats.lowestPrice = productData.price;
              }
              if (!productData.priceStats.highestPrice || (productData.originalPrice && productData.originalPrice > productData.priceStats.highestPrice)) {
                productData.priceStats.highestPrice = productData.originalPrice || productData.priceStats.highestPrice;
              }
            }

            const isStillNew = lookupRes.isNew || !lookupRes.found;

            let compareData = null;
            const targetId = productData._id || productData.productId || liveDetails.productId;
            if (targetId && api && typeof api.getCrossStoreCompare === 'function') {
              try {
                const compRes = await api.getCrossStoreCompare(targetId);
                if (compRes && compRes.success) {
                  compareData = {
                    ...(compRes.comparison || {}),
                    stores: Array.isArray(compRes.stores) ? compRes.stores : [],
                    bestSavings: Number(compRes.bestSavings) || 0,
                    bestStoreName: compRes.bestStoreName || null,
                    savingsMessage: compRes.savingsMessage || null,
                    hasExactMatch: Boolean(compRes.hasExactMatch),
                    cheaperStore: compRes.comparison?.cheaperStore || compRes.bestStoreName || null,
                    cheaperPrice: compRes.comparison?.cheaperPrice || null,
                    cheaperUrl: compRes.comparison?.cheaperUrl || null,
                    currentPrice: liveDetails.livePrice || productData.price,
                  };
                }
              } catch (e) {}
            }

            // Smoothly update widget with full historical SVG chart & cross-store savings
            ShoppersInjector.renderWidget(productData, liveDetails, compareData, isStillNew);
          }
        } catch (err) {
          console.log('[ShoppersDeals] Background lookup completed with local baseline:', err.message);
        }
      })();
    } catch (err) {
      console.warn('[ShoppersDeals] Content script error:', err);
    } finally {
      isChecking = false;
    }
  }

  function checkCheckoutPage() {
    const href = window.location.href.toLowerCase();
    const isCheckout = href.includes('/cart') || href.includes('/checkout') || href.includes('/buy') || href.includes('/viewcart');
    if (isCheckout) {
      const merchant = href.includes('amazon') ? 'amazon' : href.includes('flipkart') ? 'flipkart' : href.includes('myntra') ? 'myntra' : href.includes('nykaa') ? 'nykaa' : 'store';
      const injector = (typeof ShoppersInjector !== 'undefined')
        ? ShoppersInjector
        : (typeof window !== 'undefined' && window.ShoppersInjector)
          ? window.ShoppersInjector
          : null;
      if (injector && typeof injector.renderCouponWidget === 'function') {
        injector.renderCouponWidget({ merchant });
      }
    }
  }

  function runChecks() {
    checkAndInject();
    checkCheckoutPage();
  }

  // Initial check on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runChecks);
  } else {
    runChecks();
  }

  // Handle SPA transitions (Flipkart/Myntra/Ajio pushState or hash changes)
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(runChecks, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    setTimeout(runChecks, 500);
  });
})();
