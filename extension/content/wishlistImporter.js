/**
 * ShoppersDeals Wishlist 1-Click Importer
 * Automatically detects wishlist pages on Amazon, Flipkart, Myntra, etc.
 * Injects a floating 1-click import CTA and registers price alerts for all items.
 */

(function () {
  'use strict';

  let hasInjected = false;
  let isImporting = false;

  function initWishlistImporter() {
    const parser = (typeof ShoppersParser !== 'undefined')
      ? ShoppersParser
      : (typeof window !== 'undefined' && window.ShoppersParser)
        ? window.ShoppersParser
        : null;

    if (!parser || typeof parser.isWishlistPage !== 'function') return;

    if (!parser.isWishlistPage(window.location.href)) return;

    if (hasInjected && document.getElementById('shoppersdeals-wishlist-host')) return;

    const items = parser.extractWishlistItems();
    if (!items || items.length === 0) {
      // Retry in 1s if wishlist items are hydrating asynchronously
      setTimeout(initWishlistImporter, 1200);
      return;
    }

    renderWishlistPill(items.length);
  }

  function renderWishlistPill(initialCount) {
    if (document.getElementById('shoppersdeals-wishlist-host')) return;

    const host = document.createElement('div');
    host.id = 'shoppersdeals-wishlist-host';
    host.style.cssText = 'position: fixed; bottom: 24px; left: 24px; z-index: 2147483645; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .sd-wl-container {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: #ffffff;
        padding: 12px 18px;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.15);
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
        user-select: none;
      }
      .sd-wl-container:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.5);
      }
      .sd-wl-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #7c3aed;
        font-size: 16px;
      }
      .sd-wl-text {
        display: flex;
        flex-direction: column;
      }
      .sd-wl-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sd-wl-badge {
        background: #10b981;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 9999px;
      }
      .sd-wl-sub {
        font-size: 11px;
        color: #c7d2fe;
        margin-top: 1px;
      }
      .sd-wl-btn {
        background: #ffffff;
        color: #1e1b4b;
        border: none;
        padding: 7px 14px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s, transform 0.15s;
        margin-left: 4px;
      }
      .sd-wl-btn:hover {
        background: #f1f5f9;
        transform: scale(1.04);
      }
      .sd-wl-close {
        background: transparent;
        border: none;
        color: #a5b4fc;
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .sd-wl-close:hover {
        color: #ffffff;
      }
      .sd-wl-success {
        background: linear-gradient(135deg, #065f46 0%, #047857 100%) !important;
        border-color: #34d399 !important;
      }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'sd-wl-container';
    wrapper.id = 'sd-wl-box';
    wrapper.innerHTML = `
      <div class="sd-wl-icon">🔔</div>
      <div class="sd-wl-text">
        <div class="sd-wl-title">
          Track Wishlist <span class="sd-wl-badge" id="sd-wl-count">${initialCount} ITEMS</span>
        </div>
        <div class="sd-wl-sub" id="sd-wl-sub">1-Click Price Drop Alerts & 365-Day Charts</div>
      </div>
      <button class="sd-wl-btn" id="sd-wl-action">Track All</button>
      <button class="sd-wl-close" id="sd-wl-dismiss" title="Dismiss">×</button>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    document.body.appendChild(host);
    hasInjected = true;

    const actionBtn = shadow.querySelector('#sd-wl-action');
    const dismissBtn = shadow.querySelector('#sd-wl-dismiss');
    const countBadge = shadow.querySelector('#sd-wl-count');
    const subText = shadow.querySelector('#sd-wl-sub');
    const box = shadow.querySelector('#sd-wl-box');

    // Dynamic count update on scroll
    const updateCount = () => {
      const items = ShoppersParser.extractWishlistItems();
      if (items.length > 0 && countBadge) {
        countBadge.textContent = `${items.length} ITEMS`;
      }
    };
    window.addEventListener('scroll', updateCount, { passive: true });

    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      host.remove();
    });

    const triggerImport = async () => {
      if (isImporting) return;
      isImporting = true;
      actionBtn.disabled = true;
      actionBtn.textContent = 'Tracking...';
      subText.textContent = 'Syncing 365-day price history & setting alerts...';

      try {
        const freshItems = ShoppersParser.extractWishlistItems();
        if (freshItems.length === 0) {
          throw new Error('No wishlist products found on this page.');
        }

        const api = (typeof ShoppersAPI !== 'undefined')
          ? ShoppersAPI
          : (typeof window !== 'undefined' && window.ShoppersAPI)
            ? window.ShoppersAPI
            : null;

        if (!api || typeof api.importWishlist !== 'function') {
          throw new Error('ShoppersDeals API unavailable');
        }

        const res = await api.importWishlist(freshItems, true);
        const imported = res?.importedCount || freshItems.length;

        box.classList.add('sd-wl-success');
        actionBtn.style.display = 'none';
        subText.textContent = `✓ ${imported} products tracked! Price drop alerts active.`;
        countBadge.textContent = 'SYNCED';
        countBadge.style.background = '#34d399';

        // Notify background service worker
        try {
          chrome.runtime.sendMessage({
            type: 'WISHLIST_IMPORTED',
            count: imported
          });
        } catch (e) {}

        // Auto minimize after 6 seconds
        setTimeout(() => {
          if (host.parentElement) host.remove();
        }, 6000);
      } catch (err) {
        console.warn('[ShoppersDeals Wishlist] Import error:', err);
        actionBtn.disabled = false;
        actionBtn.textContent = 'Retry';
        subText.textContent = 'Failed to sync. Please click retry.';
      } finally {
        isImporting = false;
      }
    };

    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerImport();
    });

    box.addEventListener('click', () => {
      if (!isImporting && actionBtn.style.display !== 'none') {
        triggerImport();
      }
    });
  }

  // Lifecycle listeners
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWishlistImporter);
  } else {
    initWishlistImporter();
  }

  // SPA navigation handling
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      hasInjected = false;
      setTimeout(initWishlistImporter, 1500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
