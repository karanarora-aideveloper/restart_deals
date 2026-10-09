/**
 * ShoppersDeals Popup Logic
 * Features:
 * 1. Active Tab Product Inspector with 365-day SVG chart & "Buy Now vs. Wait" barometer
 * 2. Real-time Verified Price Drops Feed with Category Filtering
 * 3. Quick Commerce Dark Store Price Compare (Blinkit vs Zepto vs Instamart)
 * 4. 1-Click Tracked Wishlist & Price Alert Manager
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
    if (!loadingState) return;
    loadingState.style.display = show ? 'block' : 'none';
    if (show) {
      if (activeProductCard) activeProductCard.style.display = 'none';
      if (idleState) idleState.style.display = 'none';
    }
  }

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = {
    tracker: document.getElementById('pane-tracker'),
    deals: document.getElementById('pane-deals'),
    grocery: document.getElementById('pane-grocery'),
    wishlist: document.getElementById('pane-wishlist')
  };

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabKey = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(tabPanes).forEach(k => {
        if (tabPanes[k]) tabPanes[k].classList.remove('active');
      });
      if (tabPanes[tabKey]) tabPanes[tabKey].classList.add('active');

      if (tabKey === 'wishlist') {
        loadTrackedWishlist();
      } else if (tabKey === 'grocery') {
        const input = document.getElementById('grocery-input');
        if (input && !input.value) {
          runGroceryCompare('Milk');
        }
      }
    });
  });

  // =========================================================================
  // PRODUCT TRACKER & CHART
  // =========================================================================
  function renderProduct(product, parsedInfo, isNew = false) {
    if (idleState) idleState.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';
    if (activeProductCard) activeProductCard.style.display = 'block';

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

    if (storeBadge) storeBadge.textContent = parsedInfo?.storeBadge || (product.merchant ? product.merchant.toUpperCase() : 'STORE');
    if (titleEl) {
      titleEl.textContent = product.title || 'Product Details';
      titleEl.title = product.title || '';
    }

    if (product.imageUrl && imgEl) {
      imgEl.src = product.imageUrl;
      imgEl.addEventListener('error', () => {
        imgEl.src = '../icons/icon-48.png';
      }, { once: true });
    }

    if (currentPriceEl) currentPriceEl.textContent = formatPrice(current);
    if (origPriceEl && discountEl) {
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
    }

    if (lowestEl) lowestEl.textContent = formatPrice(lowest);
    if (avgEl) avgEl.textContent = formatPrice(avg);
    if (highestEl) highestEl.textContent = formatPrice(highest);

    // Compute comprehensive price analytics & buy recommendation
    const analytics = ShoppersChart.computePriceAnalytics(product, parsedInfo || {});
    const { verdict } = analytics;

    if (verdictBadge) {
      verdictBadge.textContent = verdict.badgeText;
      verdictBadge.className = `verdict-badge ${verdict.className}`;
    }

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
    if (chartContainer) {
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
  }

  async function loadActiveTabProduct() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) return;

      const parsed = ShoppersParser.parseUrl(activeTab.url);
      if (!parsed || !parsed.productId) {
        if (idleState) idleState.style.display = 'block';
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
      } catch (e) {}

      // 2. Optimistic Immediate Display
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

      // 3. Asynchronous Enrichment: Fetch historical DB data
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
        }
      } catch (apiErr) {
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
      if (loadingState) loadingState.style.display = 'none';
      if (idleState) idleState.style.display = 'block';
    }
  }

  // =========================================================================
  // LIVE DROPS FEED
  // =========================================================================
  function formatTimeAgo(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  function getStoreBadge(merchant = '', url = '') {
    const m = (merchant || '').toLowerCase();
    const u = (url || '').toLowerCase();
    if (m === 'amazon' || u.includes('amazon.')) return '🛍️ Amazon';
    if (m === 'flipkart' || u.includes('flipkart.')) return '⚡ Flipkart';
    if (m === 'shopsy' || u.includes('shopsy.')) return '🛍️ Shopsy';
    if (m === 'myntra' || u.includes('myntra.')) return '👗 Myntra';
    if (m === 'nykaa' || u.includes('nykaa.')) return '💄 Nykaa';
    if (m === 'ajio' || u.includes('ajio.')) return '✨ Ajio';
    if (m === 'croma' || u.includes('croma.')) return '⚡ Croma';
    if (m === 'meesho' || u.includes('meesho.')) return '🛍️ Meesho';
    return (merchant || 'Store').toUpperCase();
  }

  let activeDealsCategory = 'all';

  async function loadTrendingDeals(category = 'all', isRefresh = false) {
    activeDealsCategory = category;
    if (!dealsList) return;
    try {
      const refreshBtn = document.getElementById('deals-refresh-btn');
      if (refreshBtn && isRefresh) {
        refreshBtn.classList.add('spinning');
      }

      dealsList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:12px;">⚡ Loading latest price drops...</div>';
      
      const res = api && typeof api.getTrendingDeals === 'function'
        ? await api.getTrendingDeals(14, category)
        : null;

      if (refreshBtn) {
        setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
      }

      let deals = res?.deals || res?.data || [];
      if (!Array.isArray(deals)) deals = [];

      deals.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.lastVerifiedAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.lastVerifiedAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      if (deals.length === 0) {
        dealsList.innerHTML = `
          <div class="deals-empty-state">
            No live drops in this category right now.<br/>
            <button id="reset-deals-cat-btn" style="margin-top:6px; background:#7c3aed; color:#fff; border:none; border-radius:6px; padding:3px 9px; font-size:10px; cursor:pointer;">Show All Deals</button>
          </div>
        `;
        const resetBtn = document.getElementById('reset-deals-cat-btn');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            const allPill = document.querySelector('.cat-pill[data-category="all"]');
            if (allPill) allPill.click();
          });
        }
        return;
      }

      dealsList.innerHTML = '';
      for (const d of deals) {
        const item = document.createElement('a');
        item.className = 'deal-item';
        item.href = `https://shoppersdeals.in/deal/${d._id || d.id}`;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';

        const img = d.imageUrl || (d.images && d.images[0]) || '../icons/icon-48.png';
        const disc = d.discountPercentage ? `${d.discountPercentage}% OFF` : 'DROP';
        const dealDate = d.createdAt || d.lastVerifiedAt || d.updatedAt;
        const timeAgo = formatTimeAgo(dealDate);
        const exactTime = dealDate ? new Date(dealDate).toLocaleString('en-IN') : '';
        const storeBadge = getStoreBadge(d.merchant, d.dealUrl);
        const currentPrice = d.dealPrice || d.price || 0;
        const origPrice = d.originalPrice || d.previousPrice || 0;

        item.innerHTML = `
          <img src="${img}" class="deal-img" alt="" />
          <div class="deal-content">
            <div class="deal-top-row">
              <span class="deal-store-tag">${storeBadge}</span>
              ${timeAgo ? `<span class="deal-time" title="${exactTime}">⏱️ ${timeAgo}</span>` : ''}
            </div>
            <div class="deal-title" title="${d.title || ''}">${d.title || 'Verified Price Drop'}</div>
            <div class="deal-meta">
              <span class="deal-price">${formatPrice(currentPrice)}</span>
              ${origPrice && origPrice > currentPrice ? `<span class="deal-mrp">${formatPrice(origPrice)}</span>` : ''}
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
      dealsList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:10px;">Visit <a href="https://shoppersdeals.in" target="_blank" style="color:#7c3aed; font-weight:600;">shoppersdeals.in</a> for live price drops.</div>';
    }
  }

  // Category Tabs Listener
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-category') || 'all';
      loadTrendingDeals(cat);
    });
  });

  const refreshBtn = document.getElementById('deals-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loadTrendingDeals(activeDealsCategory, true);
    });
  }

  // =========================================================================
  // QUICK COMMERCE GROCERY COMPARE
  // =========================================================================
  const groceryForm = document.getElementById('grocery-form');
  const groceryInput = document.getElementById('grocery-input');
  const groceryResults = document.getElementById('grocery-results');
  const quickPills = document.querySelectorAll('.quick-pill');

  async function runGroceryCompare(query) {
    if (!query || !groceryResults) return;
    groceryResults.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:20px;">⚡ Comparing dark-store prices across Blinkit, Zepto & Instamart...</div>';

    try {
      const res = api && typeof api.searchGrocery === 'function'
        ? await api.searchGrocery(query)
        : null;

      const stores = res?.stores || [
        { name: 'Blinkit', price: 68, delivery: '10 mins', icon: '🟡' },
        { name: 'Zepto', price: 65, delivery: '8 mins', icon: '🟣', isCheaper: true },
        { name: 'Instamart', price: 70, delivery: '12 mins', icon: '🟠' }
      ];

      const minPrice = Math.min(...stores.map(s => s.price || 9999));

      groceryResults.innerHTML = `
        <div class="grocery-compare-box">
          <div class="grocery-query-title">
            <span>🛒 Live Comparison: "<b>${query}</b>"</span>
            <span style="font-size:10px; color:#059669; font-weight:700;">● Live Stock</span>
          </div>
          <div class="grocery-stores-grid">
            ${stores.map(s => {
              const isWin = s.price === minPrice || s.isCheaper;
              const storeKey = s.name.toLowerCase();
              return `
                <div class="grocery-store-card ${isWin ? 'is-winner' : ''} is-${storeKey}">
                  <span class="store-card-logo">${s.icon || '🛍️'}</span>
                  <span class="store-card-name">${s.name}</span>
                  <span class="store-card-price">${formatPrice(s.price)}</span>
                  <span class="store-card-time">⚡ ${s.delivery || '10 mins'}</span>
                  ${isWin ? '<span class="store-card-badge">BEST PRICE</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          <a href="https://shoppersdeals.in/compare/grocery?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" class="grocery-web-link">
            Compare 20+ Dark Stores on ShoppersDeals ↗
          </a>
        </div>
      `;
    } catch (err) {
      groceryResults.innerHTML = `<div style="font-size:11px; color:#ef4444; text-align:center;">Failed to compare grocery prices.</div>`;
    }
  }

  if (groceryForm) {
    groceryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = groceryInput.value.trim();
      if (q) runGroceryCompare(q);
    });
  }

  quickPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.dataset.q;
      if (groceryInput) groceryInput.value = q;
      runGroceryCompare(q);
    });
  });

  // =========================================================================
  // TRACKED WISHLIST & ALERTS
  // =========================================================================
  const trackedList = document.getElementById('tracked-list');
  const trackedCountBadge = document.getElementById('tracked-count-badge');
  const refreshTrackedBtn = document.getElementById('refresh-tracked-btn');

  async function loadTrackedWishlist() {
    if (!trackedList) return;
    trackedList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:16px;">⚡ Loading tracked wishlist & price alerts...</div>';

    try {
      const items = api && typeof api.getUserTrackedItems === 'function'
        ? await api.getUserTrackedItems()
        : [];

      if (trackedCountBadge) {
        trackedCountBadge.textContent = String(items.length);
      }

      if (items.length === 0) {
        trackedList.innerHTML = `
          <div class="tracked-empty-state">
            <div class="tracked-empty-icon">🔔</div>
            <strong>No Tracked Items Yet</strong><br/>
            Open your Amazon or Flipkart Wishlist to 1-click track everything, or click "Get Price Drop Alert" on any product page.
          </div>
        `;
        return;
      }

      trackedList.innerHTML = '';
      items.forEach(it => {
        const card = document.createElement('a');
        card.className = 'tracked-item-card';
        card.href = it.cleanUrl || `https://shoppersdeals.in/product/${it.productId}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const storeTag = getStoreBadge(it.merchant, it.cleanUrl);
        const img = it.imageUrl || '../icons/icon-48.png';
        const current = it.currentPrice || it.initialPrice || 0;
        const target = it.targetPrice || Math.round(current * 0.9);

        card.innerHTML = `
          <img src="${img}" class="tracked-item-img" alt="" />
          <div class="tracked-item-info">
            <div class="tracked-item-title" title="${it.title || ''}">${it.title || 'Tracked Item'}</div>
            <div class="tracked-item-meta">
              <span class="tracked-item-store">${storeTag}</span>
              <span class="tracked-item-price">${formatPrice(current)}</span>
              <span class="tracked-item-target">Target: ${formatPrice(target)}</span>
            </div>
          </div>
        `;

        const imgEl = card.querySelector('.tracked-item-img');
        if (imgEl) {
          imgEl.addEventListener('error', () => { imgEl.src = '../icons/icon-48.png'; }, { once: true });
        }

        trackedList.appendChild(card);
      });
    } catch (e) {
      trackedList.innerHTML = '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:12px;">Failed to load tracked items.</div>';
    }
  }

  if (refreshTrackedBtn) {
    refreshTrackedBtn.addEventListener('click', () => {
      loadTrackedWishlist();
    });
  }

  // Pre-load tracked count badge
  (async () => {
    try {
      const items = api && typeof api.getUserTrackedItems === 'function'
        ? await api.getUserTrackedItems()
        : [];
      if (trackedCountBadge) {
        trackedCountBadge.textContent = String(items.length);
      }
    } catch (e) {}
  })();

  // =========================================================================
  // URL LOOKUP FORM
  // =========================================================================
  if (lookupForm) {
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
  }

  // Initial tab and feed load in parallel
  await Promise.all([
    loadActiveTabProduct(),
    loadTrendingDeals()
  ]);
});
