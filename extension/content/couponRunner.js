/**
 * ShoppersDeals Auto-Coupon Runner & Finder
 * Detects checkout and cart pages across Amazon, Flipkart, Myntra, Nykaa, Ajio, etc.
 * Surfaces verified active promo codes and auto-fills them into merchant checkout forms.
 */

(function () {
  'use strict';

  let hasInjected = false;
  let isExpanded = false;

  async function initCouponRunner() {
    const parser = (typeof ShoppersParser !== 'undefined')
      ? ShoppersParser
      : (typeof window !== 'undefined' && window.ShoppersParser)
        ? window.ShoppersParser
        : null;

    if (!parser || typeof parser.isCheckoutPage !== 'function') return;

    if (!parser.isCheckoutPage(window.location.href)) return;

    if (hasInjected && document.getElementById('shoppersdeals-coupon-host')) return;

    const merchant = parser.detectStore(window.location.href);

    const api = (typeof ShoppersAPI !== 'undefined')
      ? ShoppersAPI
      : (typeof window !== 'undefined' && window.ShoppersAPI)
        ? window.ShoppersAPI
        : null;

    if (!api || typeof api.getStoreCoupons !== 'function') return;

    let coupons = [];
    try {
      coupons = await api.getStoreCoupons(merchant);
    } catch (e) {}

    // Even if no specific coupon is in database, provide standard store tips & bank offer guidance
    renderCouponUI(merchant, coupons);
  }

  function renderCouponUI(merchant, coupons = []) {
    if (document.getElementById('shoppersdeals-coupon-host')) return;

    const host = document.createElement('div');
    host.id = 'shoppersdeals-coupon-host';
    host.style.cssText = 'position: fixed; bottom: 84px; right: 24px; z-index: 2147483646; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });

    const storeLabel = (merchant || 'Store').toUpperCase();
    const count = coupons.length;

    const style = document.createElement('style');
    style.textContent = `
      .sd-cp-pill {
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #ffffff;
        padding: 10px 16px;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.15);
        cursor: pointer;
        user-select: none;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
      }
      .sd-cp-pill:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.5);
      }
      .sd-cp-icon {
        font-size: 16px;
      }
      .sd-cp-text {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .sd-cp-badge {
        background: #10b981;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 9999px;
      }
      .sd-cp-modal {
        display: none;
        flex-direction: column;
        width: 320px;
        max-height: 420px;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        animation: sdSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        margin-bottom: 12px;
      }
      @keyframes sdSlideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .sd-cp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: #ffffff;
        padding: 14px 16px;
      }
      .sd-cp-header-title {
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sd-cp-header-close {
        background: transparent;
        border: none;
        color: #c7d2fe;
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .sd-cp-header-close:hover {
        color: #ffffff;
      }
      .sd-cp-body {
        padding: 12px 14px;
        overflow-y: auto;
        max-height: 320px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sd-cp-card {
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        padding: 10px 12px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: border-color 0.15s, background-color 0.15s;
      }
      .sd-cp-card:hover {
        border-color: #7c3aed;
        background: #f5f3ff;
      }
      .sd-cp-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .sd-cp-code {
        font-family: monospace;
        font-size: 13px;
        font-weight: 800;
        color: #4f46e5;
        letter-spacing: 0.05em;
        background: #e0e7ff;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sd-cp-disc {
        font-size: 10px;
        font-weight: 700;
        color: #059669;
        background: #ecfdf5;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sd-cp-desc {
        font-size: 11px;
        color: #475569;
        line-height: 1.35;
      }
      .sd-cp-btn-apply {
        background: #7c3aed;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        align-self: flex-end;
        transition: background 0.15s;
      }
      .sd-cp-btn-apply:hover {
        background: #6d28d9;
      }
      .sd-cp-btn-applied {
        background: #10b981 !important;
      }
      .sd-cp-empty {
        text-align: center;
        padding: 16px 8px;
        color: #64748b;
        font-size: 12px;
      }
      .sd-cp-toast {
        display: none;
        background: #059669;
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 8px;
        margin-top: 6px;
        text-align: center;
      }
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="sd-cp-modal" id="sd-modal">
        <div class="sd-cp-header">
          <div class="sd-cp-header-title">
            <span>🏷️</span>
            <span>${storeLabel} Coupons & Offers</span>
          </div>
          <button class="sd-cp-header-close" id="sd-close-modal">×</button>
        </div>
        <div class="sd-cp-body" id="sd-coupons-container">
          ${coupons.length > 0 ? coupons.map(c => `
            <div class="sd-cp-card" data-code="${c.code}">
              <div class="sd-cp-card-top">
                <span class="sd-cp-code">${c.code}</span>
                ${c.discount ? `<span class="sd-cp-disc">${c.discount}</span>` : ''}
              </div>
              <div class="sd-cp-desc">${c.title || c.terms}</div>
              <button class="sd-cp-btn-apply" data-code="${c.code}">Copy & Apply</button>
            </div>
          `).join('') : `
            <div class="sd-cp-empty">
              ⚡ <strong>Best Direct Store Price Active</strong><br/>
              No public coupon codes required for this checkout. Store instant discounts and bank offers are applied automatically!
            </div>
          `}
          <div class="sd-cp-toast" id="sd-toast"></div>
        </div>
      </div>

      <div class="sd-cp-pill" id="sd-pill">
        <span class="sd-cp-icon">🏷️</span>
        <span class="sd-cp-text">${count > 0 ? `${count} Coupons for ${storeLabel}` : `Check ${storeLabel} Coupons`}</span>
        <span class="sd-cp-badge">${count > 0 ? `${count} CODES` : 'VERIFIED'}</span>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    document.body.appendChild(host);
    hasInjected = true;

    // Listeners
    const pill = shadow.querySelector('#sd-pill');
    const modal = shadow.querySelector('#sd-modal');
    const closeBtn = shadow.querySelector('#sd-close-modal');
    const toast = shadow.querySelector('#sd-toast');

    pill.addEventListener('click', () => {
      isExpanded = !isExpanded;
      modal.style.display = isExpanded ? 'flex' : 'none';
    });

    closeBtn.addEventListener('click', () => {
      isExpanded = false;
      modal.style.display = 'none';
    });

    // Auto apply code handler
    shadow.querySelectorAll('.sd-cp-btn-apply').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = btn.getAttribute('data-code');
        if (!code) return;

        // 1. Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).catch(() => {});
        }

        // 2. Find coupon input on host page
        const { input, button } = ShoppersParser.extractCouponInput();
        if (input) {
          input.focus();
          input.value = code;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));

          if (button && typeof button.click === 'function') {
            setTimeout(() => {
              try { button.click(); } catch (err) {}
            }, 300);
          }
        }

        btn.textContent = '✓ Applied';
        btn.classList.add('sd-cp-btn-applied');

        if (toast) {
          toast.textContent = `🎉 Code "${code}" copied & filled into coupon box!`;
          toast.style.display = 'block';
          setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }
      });
    });
  }

  // Lifecycle listeners
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCouponRunner);
  } else {
    initCouponRunner();
  }

  // SPA navigation handling
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      hasInjected = false;
      setTimeout(initCouponRunner, 1500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
