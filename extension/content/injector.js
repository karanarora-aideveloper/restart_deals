/**
 * ShoppersDeals Shadow DOM Injected UI
 * Injects an isolated, beautiful floating price tracker widget into store PDPs.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShoppersInjector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let containerEl = null;
  let shadowRoot = null;
  let isCardOpen = false;
  let currentProductData = null;

  function initShadowHost() {
    if (containerEl && shadowRoot) return { containerEl, shadowRoot };

    containerEl = document.createElement('shoppersdeals-widget');
    containerEl.id = 'shoppersdeals-root';
    shadowRoot = containerEl.attachShadow({ mode: 'open' });

    // Load styles.css inside Shadow DOM
    const cssUrl = chrome.runtime.getURL('content/styles.css');
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = cssUrl;
    shadowRoot.appendChild(linkEl);

    document.body.appendChild(containerEl);
    return { containerEl, shadowRoot };
  }

  function formatPrice(val) {
    if (!val && val !== 0) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  function computeVerdict(product) {
    const stats = product.priceStats || {};
    const lowest = stats.lowestPrice || product.price;
    const current = product.price;
    const avg = stats.averagePrice || product.price;

    if (current <= lowest) {
      return {
        className: 'sd-verdict-atl',
        tag: '🔥 All-Time Lowest Price',
        desc: 'This product is at its historical lowest tracked price!'
      };
    } else if (current < avg * 0.95) {
      return {
        className: 'sd-verdict-good',
        tag: '⚡ Great Deal',
        desc: `Priced ${Math.round(((avg - current) / avg) * 100)}% lower than average.`
      };
    } else if (current > avg * 1.1) {
      return {
        className: 'sd-verdict-high',
        tag: '⚠️ Price Inflated',
        desc: 'Price is higher than typical historical checkpoints.'
      };
    }
    return {
      className: 'sd-verdict-normal',
      tag: '⚖️ Normal Price',
      desc: 'Priced around its regular historical range.'
    };
  }

  function renderWidget(product, liveDetails, compareData = null, isNew = false) {
    initShadowHost();
    currentProductData = product;
    const isNewProduct = isNew || product.isNew || false;

    // Run comprehensive price analytics & buy recommendation engine
    const analytics = ShoppersChart.computePriceAnalytics(product, liveDetails);
    const { currentPrice, lowestPrice, avgPrice, highestPrice, verdict } = analytics;

    // Chart HTML: interactive SVG with range pills and hover scrubbing
    const chartHtml = ShoppersChart.renderPriceHistorySvg(product.priceHistory || [], {
      width: 400,
      height: 175,
      currentPrice,
      mrp: analytics.mrp,
      range: 'ALL'
    });

    // Cross-store comparison HTML if available
    let compareHtml = '';
    if (compareData && compareData.cheaperStore) {
      const saving = compareData.currentPrice - compareData.cheaperPrice;
      compareHtml = `
        <div class="sd-compare-box">
          <div class="sd-compare-info">
            <span class="sd-compare-text">⚡ Cheaper on ${compareData.cheaperStore}</span>
            <span class="sd-compare-saving">Save ${formatPrice(saving)} (${formatPrice(compareData.cheaperPrice)})</span>
          </div>
          <a href="${compareData.cheaperUrl}" target="_blank" rel="noopener noreferrer" class="sd-btn-compare">
            View on ${compareData.cheaperStore}
          </a>
        </div>
      `;
    }

    const iconUrl = chrome.runtime.getURL('icons/icon-32.png');
    const pillText = isNewProduct ? `✨ Track: ${formatPrice(currentPrice)}` : `Lowest: ${formatPrice(lowestPrice)}`;
    const pillBadge = isNewProduct ? 'NEW' : (verdict.badgeText.includes('ALL-TIME') ? 'ATL' : verdict.badgeText.split(' ')[0]);

    const contentHtml = `
      <!-- Floating Pill Trigger -->
      <div class="sd-pill-trigger" id="sd-pill">
        <div class="sd-pill-logo">
          <img src="${iconUrl}" width="16" height="16" alt="SD" />
        </div>
        <span class="sd-pill-text">${pillText}</span>
        <span class="sd-pill-badge">${pillBadge}</span>
      </div>

      <!-- Expandable Modal Card -->
      <div class="sd-modal-card" id="sd-card" style="display: none;">
        <!-- Header -->
        <div class="sd-card-header">
          <div class="sd-header-brand">
            <img src="${iconUrl}" width="20" height="20" alt="ShoppersDeals" />
            <span class="sd-header-title">Price History & Analytics</span>
            ${isNewProduct ? '<span style="background: #ede9fe; color: #6d28d9; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">✨ Just Added</span>' : ''}
          </div>
          <div class="sd-header-actions">
            <button class="sd-btn-icon" id="sd-close-btn" title="Minimize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="sd-card-body">
          <!-- Newly Tracked Notice Banner -->
          ${isNewProduct ? `
            <div class="sd-notice-box">
              <div class="sd-notice-icon">✨</div>
              <div class="sd-notice-content">
                <div class="sd-notice-title">First Time Tracking This Product!</div>
                <div class="sd-notice-desc">
                  This product was not in our database. We've added it to our tracking network and scheduled daily automated price checks!
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Smart Price Analytics & Buy Verdict Card -->
          ${ShoppersChart.renderPriceAnalyticsHtml(analytics)}

          <!-- Price Position Indicator (ATL to Peak Gauge) -->
          ${ShoppersChart.renderPricePositionMeterHtml(analytics)}

          <!-- Price Stats Grid -->
          <div class="sd-stats-grid">
            <div class="sd-stat-card">
              <div class="sd-stat-label">Lowest Ever</div>
              <div class="sd-stat-val sd-stat-lowest">${formatPrice(lowestPrice)}</div>
            </div>
            <div class="sd-stat-card">
              <div class="sd-stat-label">Average Price</div>
              <div class="sd-stat-val">${formatPrice(avgPrice)}</div>
            </div>
            <div class="sd-stat-card">
              <div class="sd-stat-label">Highest Peak</div>
              <div class="sd-stat-val sd-stat-highest">${formatPrice(highestPrice)}</div>
            </div>
          </div>

          <!-- Cross-Store Compare -->
          ${compareHtml}

          <!-- Interactive Price History Chart Container -->
          <div id="sd-chart-mount">
            ${chartHtml}
          </div>

          <!-- Set Price Drop Alert -->
          <div class="sd-alert-box">
            <div class="sd-alert-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Get Price Drop Alert
            </div>
            <div class="sd-alert-input-group">
              <input type="number" id="sd-target-price" class="sd-alert-input" placeholder="Target ₹" value="${verdict.recommendedTargetPrice || Math.round(currentPrice * 0.9)}" />
              <input type="email" id="sd-alert-email" class="sd-alert-input" placeholder="Your email or phone" />
              <button class="sd-btn-alert" id="sd-alert-btn">Notify Me</button>
            </div>
            <div id="sd-alert-feedback" style="display:none; font-size:11px; margin-top:6px; color:#059669; font-weight:600;"></div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sd-card-footer">
          <a href="https://t.me/ShoppersDealsAlertBot" target="_blank" rel="noopener noreferrer" class="sd-link-tg">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Instant Telegram Bot Alerts
          </a>
          <a href="https://shoppersdeals.in" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: none;">
            shoppersdeals.in ↗
          </a>
        </div>
      </div>
    `;

    // Existing nodes cleanup except stylesheet
    const linkEl = shadowRoot.querySelector('link');
    shadowRoot.innerHTML = '';
    if (linkEl) shadowRoot.appendChild(linkEl);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = contentHtml;
    shadowRoot.appendChild(wrapper);

    // Event Listeners
    const pill = shadowRoot.querySelector('#sd-pill');
    const card = shadowRoot.querySelector('#sd-card');
    const closeBtn = shadowRoot.querySelector('#sd-close-btn');
    const alertBtn = shadowRoot.querySelector('#sd-alert-btn');

    pill.addEventListener('click', () => {
      isCardOpen = !isCardOpen;
      card.style.display = isCardOpen ? 'flex' : 'none';
      pill.style.display = isCardOpen ? 'none' : 'flex';
    });

    closeBtn.addEventListener('click', () => {
      isCardOpen = false;
      card.style.display = 'none';
      pill.style.display = 'flex';
    });

    // Initialize interactive chart listeners for scrub tooltips and range tabs
    const chartMount = shadowRoot.querySelector('#sd-chart-mount');
    if (chartMount && typeof ShoppersChart.attachChartListeners === 'function') {
      const attach = (range = 'ALL') => {
        chartMount.innerHTML = ShoppersChart.renderPriceHistorySvg(product.priceHistory || [], {
          width: 400,
          height: 175,
          currentPrice,
          mrp: analytics.mrp,
          range
        });
        ShoppersChart.attachChartListeners(chartMount, product.priceHistory || [], {
          width: 400,
          height: 175,
          currentPrice,
          mrp: analytics.mrp
        }, (newRange) => attach(newRange));
      };
      ShoppersChart.attachChartListeners(chartMount, product.priceHistory || [], {
        width: 400,
        height: 175,
        currentPrice,
        mrp: analytics.mrp
      }, (newRange) => attach(newRange));
    }

    alertBtn.addEventListener('click', async () => {
      const targetInput = shadowRoot.querySelector('#sd-target-price');
      const contactInput = shadowRoot.querySelector('#sd-alert-email');
      const feedback = shadowRoot.querySelector('#sd-alert-feedback');

      const targetPrice = targetInput.value;
      const contact = contactInput.value.trim();

      if (!targetPrice || !contact) {
        feedback.style.display = 'block';
        feedback.style.color = '#dc2626';
        feedback.textContent = 'Please enter both target price and email/phone.';
        return;
      }

      alertBtn.disabled = true;
      alertBtn.textContent = 'Saving...';

      try {
        const isEmail = contact.includes('@');
        const api = (typeof ShoppersAPI !== 'undefined')
          ? ShoppersAPI
          : (typeof window !== 'undefined' && window.ShoppersAPI)
            ? window.ShoppersAPI
            : (typeof globalThis !== 'undefined' && globalThis.ShoppersAPI)
              ? globalThis.ShoppersAPI
              : null;

        if (!api || typeof api.createPriceAlert !== 'function') {
          throw new Error('API client unavailable');
        }

        await api.createPriceAlert({
          productId: product.productId || liveDetails.productId,
          merchant: product.merchant || liveDetails.merchant,
          targetPrice: Number(targetPrice),
          email: isEmail ? contact : null,
          phone: !isEmail ? contact : null
        });

        feedback.style.display = 'block';
        feedback.style.color = '#059669';
        feedback.textContent = '✓ Alert set! We will notify you when price drops.';
        contactInput.value = '';
      } catch (err) {
        feedback.style.display = 'block';
        feedback.style.color = '#dc2626';
        feedback.textContent = 'Failed to set alert. Please try again.';
      } finally {
        alertBtn.disabled = false;
        alertBtn.textContent = 'Notify Me';
      }
    });
  }

  return {
    renderWidget
  };
});
