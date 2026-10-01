/**
 * ShoppersDeals Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const activeProductCard = document.getElementById('active-product-card');
  const loadingState = document.getElementById('loading-state');
  const idleState = document.getElementById('idle-state');
  const lookupForm = document.getElementById('lookup-form');
  const lookupInput = document.getElementById('lookup-input');
  const dealsList = document.getElementById('deals-list');

  const api = (typeof ShoppersAPI !== 'undefined')
    ? ShoppersAPI
    : (typeof window !== 'undefined' && window.ShoppersAPI)
      ? window.ShoppersAPI
      : (typeof globalThis !== 'undefined' && globalThis.ShoppersAPI)
        ? globalThis.ShoppersAPI
        : null;

  function formatPrice(val) {
    if (!val && val !== 0) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  function showLoading(show) {
    loadingState.style.display = show ? 'block' : 'none';
    if (show) {
      activeProductCard.style.display = 'none';
      idleState.style.display = 'none';
    }
  }

  function renderProduct(product, parsedInfo, isNew = false) {
    idleState.style.display = 'none';
    loadingState.style.display = 'none';
    activeProductCard.style.display = 'block';

    const storeBadge = document.getElementById('product-store-badge');
    const verdictBadge = document.getElementById('product-verdict-badge');
    const noticeBanner = document.getElementById('product-notice-banner');
    const imgEl = document.getElementById('product-img');
    const titleEl = document.getElementById('product-title');
    const currentPriceEl = document.getElementById('product-current-price');
    const origPriceEl = document.getElementById('product-original-price');
    const discountEl = document.getElementById('product-discount');

    const lowestEl = document.getElementById('stat-lowest');
    const avgEl = document.getElementById('stat-average');
    const highestEl = document.getElementById('stat-highest');
    const chartContainer = document.getElementById('chart-container');

    const stats = product.priceStats || {};
    const lowest = stats.lowestPrice || product.price || 0;
    const highest = stats.highestPrice || product.originalPrice || product.price || 0;
    const current = product.price || 0;
    const avg = stats.averagePrice || current;

    storeBadge.textContent = parsedInfo?.storeBadge || (product.merchant ? product.merchant.toUpperCase() : 'STORE');
    titleEl.textContent = product.title || 'Product Details';
    titleEl.title = product.title || '';

    if (product.imageUrl) {
      imgEl.src = product.imageUrl;
      imgEl.addEventListener('error', () => {
        imgEl.src = '../icons/icon-48.png';
      }, { once: true });
    }

    currentPriceEl.textContent = formatPrice(current);
    if (product.originalPrice && product.originalPrice > current) {
      origPriceEl.textContent = formatPrice(product.originalPrice);
      origPriceEl.style.display = 'inline';
      const disc = Math.round(((product.originalPrice - current) / product.originalPrice) * 100);
      discountEl.textContent = `${disc}% OFF`;
      discountEl.style.display = 'inline';
    } else {
      origPriceEl.style.display = 'none';
      discountEl.style.display = 'none';
    }

    lowestEl.textContent = formatPrice(lowest);
    avgEl.textContent = formatPrice(avg);
    highestEl.textContent = formatPrice(highest);

    // Compute comprehensive price analytics & buy recommendation
    const analytics = ShoppersChart.computePriceAnalytics(product, parsedInfo || {});
    const { verdict } = analytics;

    verdictBadge.textContent = verdict.badgeText;
    verdictBadge.className = `verdict-badge ${verdict.className}`;

    if (noticeBanner) {
      noticeBanner.style.display = (isNew || product.isNew) ? 'block' : 'none';
    }

    // Render Price Analytics Advice Card in popup
    const analyticsMount = document.getElementById('analytics-mount');
    if (analyticsMount) {
      analyticsMount.innerHTML = ShoppersChart.renderPriceAnalyticsHtml(analytics);
    }

    // Render Price Position Meter in popup
    const gaugeMount = document.getElementById('gauge-mount');
    if (gaugeMount) {
      gaugeMount.innerHTML = ShoppersChart.renderPricePositionMeterHtml(analytics);
    }

    // Render and attach interactive chart listeners
    const attachPopupChart = (range = 'ALL') => {
      chartContainer.innerHTML = ShoppersChart.renderPriceHistorySvg(product.priceHistory || [], {
        width: 340,
        height: 160,
        currentPrice: analytics.currentPrice,
        mrp: analytics.mrp,
        range
      });
      ShoppersChart.attachChartListeners(chartContainer, product.priceHistory || [], {
        width: 340,
        height: 160,
        currentPrice: analytics.currentPrice,
        mrp: analytics.mrp
      }, (newRange) => attachPopupChart(newRange));
    };

    attachPopupChart('ALL');
  }

  async function loadActiveTabProduct() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) return;

      const parsed = ShoppersParser.parseUrl(activeTab.url);
      if (!parsed || !parsed.productId) {
        idleState.style.display = 'block';
        return;
      }

      // 1. Attempt to read live page details in 0ms
      let liveDetails = null;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            return (typeof ShoppersParser !== 'undefined' && ShoppersParser.extractLivePageDetails)
              ? ShoppersParser.extractLivePageDetails()
              : null;
          }
        });
        if (results && results[0] && results[0].result) {
          liveDetails = results[0].result;
        }
      } catch (e) {
        console.log('[Popup] Scripting note:', e.message);
      }

      // 2. Optimistic Immediate Display: If live details available, render immediately without waiting!
      if (liveDetails && (liveDetails.liveTitle || liveDetails.livePrice)) {
        renderProduct({
          productId: liveDetails.productId,
          merchant: liveDetails.merchant,
          title: liveDetails.liveTitle || 'Product Details',
          price: liveDetails.livePrice,
          originalPrice: liveDetails.liveMRP,
          imageUrl: liveDetails.liveImage,
          isNew: true,
          priceStats: {
            lowestPrice: liveDetails.livePrice,
            averagePrice: liveDetails.livePrice,
            highestPrice: liveDetails.liveMRP || liveDetails.livePrice,
            currentPrice: liveDetails.livePrice
          }
        }, parsed, true);
      } else {
        showLoading(true);
      }

      // 3. Asynchronous Enrichment: Fetch historical DB data via background service worker
      try {
        const detailsWithUrl = { ...(liveDetails || {}), cleanUrl: parsed.cleanUrl, sourceUrl: activeTab.url };
        const res = api && typeof api.lookupProduct === 'function'
          ? await api.lookupProduct(parsed.cleanUrl || activeTab.url, detailsWithUrl)
          : null;
        if (res && res.success && res.data) {
          const mergedData = res.data;
          if (liveDetails && liveDetails.livePrice) {
            mergedData.price = liveDetails.livePrice;
            if (liveDetails.liveMRP) mergedData.originalPrice = liveDetails.liveMRP;
            if (liveDetails.liveTitle && (!mergedData.title || mergedData.title.length < liveDetails.liveTitle.length)) {
              mergedData.title = liveDetails.liveTitle;
            }
            if (liveDetails.liveImage && !mergedData.imageUrl) {
              mergedData.imageUrl = liveDetails.liveImage;
            }

            // Ensure priceHistory is populated and ends with today's live price
            if (!Array.isArray(mergedData.priceHistory)) mergedData.priceHistory = [];
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const todayIdx = mergedData.priceHistory.findIndex(h => {
              if (h.date === todayStr) return true;
              if (h.timestamp) {
                return new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
              }
              return false;
            });
            if (todayIdx >= 0) {
              mergedData.priceHistory[todayIdx].price = liveDetails.livePrice;
              if (liveDetails.liveMRP) mergedData.priceHistory[todayIdx].originalPrice = liveDetails.liveMRP;
              mergedData.priceHistory[todayIdx].timestamp = new Date();
            } else {
              mergedData.priceHistory.push({
                date: todayStr,
                price: liveDetails.livePrice,
                originalPrice: liveDetails.liveMRP || mergedData.originalPrice || liveDetails.livePrice,
                timestamp: new Date()
              });
            }

            // Recalculate priceStats with authoritative live price
            if (mergedData.priceStats) {
              mergedData.priceStats.currentPrice = mergedData.price;
              if (!mergedData.priceStats.lowestPrice || mergedData.price < mergedData.priceStats.lowestPrice) {
                mergedData.priceStats.lowestPrice = mergedData.price;
              }
              if (!mergedData.priceStats.highestPrice || (mergedData.originalPrice && mergedData.originalPrice > mergedData.priceStats.highestPrice)) {
                mergedData.priceStats.highestPrice = mergedData.originalPrice || mergedData.priceStats.highestPrice;
              }
            }
          }
          renderProduct(mergedData, parsed, res.isNew || !res.found);
        } else if (!liveDetails) {
          renderProduct({
            productId: parsed.productId,
            merchant: parsed.merchant,
            title: 'Queued for Price Tracking',
            price: 0,
            isNew: true,
            priceStats: { lowestPrice: 0, averagePrice: 0, highestPrice: 0, currentPrice: 0 }
          }, parsed, true);
        }
      } catch (apiErr) {
        console.log('[Popup] Background enrichment note:', apiErr.message);
        if (!liveDetails) {
          renderProduct({
            productId: parsed.productId,
            merchant: parsed.merchant,
            title: 'Queued for Price Tracking',
            price: 0,
            isNew: true,
            priceStats: { lowestPrice: 0, averagePrice: 0, highestPrice: 0, currentPrice: 0 }
          }, parsed, true);
        }
      }
    } catch (e) {
      console.warn('[Popup] Active tab inspection error:', e);
      loadingState.style.display = 'none';
      idleState.style.display = 'block';
    }
  }

  async function loadTrendingDeals() {
    try {
      dealsList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:8px;">Loading live deals...</div>';
      const res = api && typeof api.getTrendingDeals === 'function' ? await api.getTrendingDeals(6) : null;
      
      const deals = res?.deals || res?.data || [];
      if (!deals || deals.length === 0) {
        dealsList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:8px;">No live deals currently.</div>';
        return;
      }

      dealsList.innerHTML = '';
      for (const d of deals) {
        const item = document.createElement('a');
        item.className = 'deal-item';
        item.href = `https://shoppersdeals.in/deal/${d._id || d.id}`;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';

        const img = d.imageUrl || '../icons/icon-48.png';
        const disc = d.discountPercentage ? `${d.discountPercentage}% OFF` : 'DROP';

        item.innerHTML = `
          <img src="${img}" class="deal-img" alt="" />
          <div class="deal-content">
            <div class="deal-title" title="${d.title || ''}">${d.title || 'Verified Price Drop'}</div>
            <div class="deal-meta">
              <span class="deal-price">${formatPrice(d.dealPrice || d.price)}</span>
              ${d.originalPrice ? `<span class="deal-mrp">${formatPrice(d.originalPrice)}</span>` : ''}
              <span class="deal-tag">${disc}</span>
            </div>
          </div>
        `;

        const dealImg = item.querySelector('.deal-img');
        if (dealImg) {
          dealImg.addEventListener('error', () => {
            dealImg.src = '../icons/icon-48.png';
          }, { once: true });
        }

        dealsList.appendChild(item);
      }
    } catch (e) {
      console.warn('[Popup] Failed to load trending deals:', e);
      dealsList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:8px;">Visit shoppersdeals.in for live drops.</div>';
    }
  }

  // Handle Lookup Form
  lookupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = lookupInput.value.trim();
    if (!query) return;

    const parsed = ShoppersParser.parseUrl(query);
    if (!parsed || !parsed.productId) {
      alert('Please enter a valid Amazon, Flipkart, Myntra, Nykaa, or Ajio product URL.');
      return;
    }

    showLoading(true);
    try {
      const res = api && typeof api.lookupProduct === 'function'
        ? await api.lookupProduct(query, { sourceUrl: query })
        : null;
      if (res && res.success && res.data) {
        renderProduct(res.data, parsed, res.isNew || !res.found);
      } else {
        renderProduct({
          productId: parsed.productId,
          merchant: parsed.merchant,
          title: 'Queued for Price Tracking',
          price: 0,
          isNew: true,
          priceStats: { lowestPrice: 0, averagePrice: 0, highestPrice: 0, currentPrice: 0 }
        }, parsed, true);
      }
    } catch (err) {
      console.warn('[Popup] Lookup error:', err);
      renderProduct({
        productId: parsed.productId,
        merchant: parsed.merchant,
        title: 'Queued for Price Tracking',
        price: 0,
        isNew: true,
        priceStats: { lowestPrice: 0, averagePrice: 0, highestPrice: 0, currentPrice: 0 }
      }, parsed, true);
    }
  });

  // Run in parallel
  await Promise.all([
    loadActiveTabProduct(),
    loadTrendingDeals()
  ]);
});
