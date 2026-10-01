/**
 * ShoppersDeals Interactive SVG Price History Chart & Price Analytics Engine
 * High-performance, zero-dependency, ultra-crisp vector chart with crosshairs,
 * interactive tooltips, time-range filters, and "Good Time to Buy?" intelligence.
 */

(function (root, factory) {
  const chartModule = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = chartModule;
  }
  if (root) {
    root.ShoppersChart = chartModule;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function formatPrice(num) {
    if (!num && num !== 0) return '₹0';
    return '₹' + Number(Math.round(num)).toLocaleString('en-IN');
  }

  function formatDate(d, options = {}) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    if (options.short) {
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Comprehensive Price Intelligence & "Good Time to Buy?" Engine
   */
  function computePriceAnalytics(productData = {}, liveDetails = {}) {
    const rawPrice = (liveDetails && liveDetails.livePrice) || productData.price || 0;
    const currentPrice = Number(rawPrice) || 0;

    const rawMRP = (liveDetails && liveDetails.liveMRP) || productData.originalPrice || currentPrice;
    const mrp = Math.max(Number(rawMRP) || currentPrice, currentPrice);

    const history = Array.isArray(productData.priceHistory) ? productData.priceHistory : [];
    const validHistory = history
      .filter(h => h && h.price && h.timestamp)
      .map(h => ({
        price: Number(h.price),
        date: new Date(h.timestamp)
      }))
      .sort((a, b) => a.date - b.date);

    const prices = validHistory.map(h => h.price);
    if (currentPrice > 0 && !prices.includes(currentPrice)) {
      prices.push(currentPrice);
    }

    const lowestPrice = prices.length > 0 ? Math.min(...prices) : currentPrice;
    const highestPrice = prices.length > 0 ? Math.max(...prices) : (mrp || currentPrice);
    const avgPrice = prices.length > 0
      ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
      : currentPrice;

    const dropFromPeak = Math.max(0, highestPrice - currentPrice);
    const dropFromPeakPct = highestPrice > 0 ? Math.round((dropFromPeak / highestPrice) * 100) : 0;

    const diffFromAvg = currentPrice - avgPrice;
    const diffFromAvgPct = avgPrice > 0 ? Math.round((Math.abs(diffFromAvg) / avgPrice) * 100) : 0;

    const discountFromMrp = Math.max(0, mrp - currentPrice);
    const discountFromMrpPct = mrp > 0 ? Math.round((discountFromMrp / mrp) * 100) : 0;

    const isBaselineOnly = validHistory.length < 2;

    // Price position percentage (0 = ATL, 100 = Peak)
    const priceSpan = highestPrice - lowestPrice;
    let positionPct = priceSpan > 0
      ? Math.round(((currentPrice - lowestPrice) / priceSpan) * 100)
      : 50;
    positionPct = Math.max(0, Math.min(100, positionPct));

    // Determine Buy Verdict & Advice
    let verdictClass = 'sd-verdict-good';
    let badgeText = '⚡ GOOD TIME TO BUY';
    let headline = 'Good Time to Buy';
    let summary = '';
    let advice = '';
    let score = 75; // 0 (Worst) - 100 (Best)

    if (isBaselineOnly) {
      verdictClass = 'sd-verdict-new';
      badgeText = '✨ NEWLY TRACKED BASELINE';
      headline = 'First Price Checkpoint Recorded';
      score = discountFromMrpPct >= 30 ? 80 : 65;
      if (discountFromMrpPct > 0) {
        summary = `Currently selling at ${formatPrice(currentPrice)} (${discountFromMrpPct}% off MRP ${formatPrice(mrp)}). Baseline logged for continuous tracking!`;
        advice = `Set a price drop alert for ${formatPrice(Math.round(currentPrice * 0.9))} (10% drop) to be notified as soon as a deal drops.`;
      } else {
        summary = `Priced at ${formatPrice(currentPrice)}. Added to ShoppersDeals tracking network with daily automated price scans.`;
        advice = `Set an alert to automatically get notified when this product drops below your desired budget.`;
      }
    } else if (currentPrice <= lowestPrice * 1.015) {
      // At or within 1.5% of All-Time Low!
      verdictClass = 'sd-verdict-best';
      badgeText = '🔥 BEST TIME TO BUY — ALL-TIME LOW';
      headline = 'Lowest Price Ever Tracked!';
      score = 98;
      summary = `Currently at its all-time record low price of ${formatPrice(currentPrice)}. You save ${formatPrice(dropFromPeak)} (${dropFromPeakPct}%) compared to its peak price of ${formatPrice(highestPrice)}.`;
      advice = 'Unbeatable deal! Prices rarely stay at this level for long. Highly recommended to buy right now.';
    } else if (currentPrice < avgPrice * 0.95) {
      // At least 5% below average
      verdictClass = 'sd-verdict-good';
      badgeText = '⚡ GREAT DEAL — BELOW AVERAGE';
      headline = 'Substantially Below Typical Price';
      score = 85;
      summary = `Priced ${formatPrice(Math.abs(diffFromAvg))} (${diffFromAvgPct}%) lower than the typical average price of ${formatPrice(avgPrice)}.`;
      advice = 'Favorable price point. A great time to buy if you need this item now.';
    } else if (currentPrice <= avgPrice * 1.05) {
      // Within +/- 5% of average
      verdictClass = 'sd-verdict-fair';
      badgeText = '⚖️ AVERAGE / FAIR PRICE';
      headline = 'Priced in Regular Range';
      score = 55;
      summary = `Selling near its historical average of ${formatPrice(avgPrice)}. Price has been as low as ${formatPrice(lowestPrice)}.`;
      advice = `If not in a hurry, consider waiting. You can save up to ${formatPrice(currentPrice - lowestPrice)} by waiting for the next sale drop.`;
    } else {
      // More than 5% above average or near highest
      verdictClass = 'sd-verdict-wait';
      badgeText = '⚠️ PRICE INFLATED — WAIT';
      headline = 'High Price — Wait for Drop';
      score = 25;
      summary = `Currently ${formatPrice(diffFromAvg)} (${diffFromAvgPct}%) higher than usual (average is ${formatPrice(avgPrice)}), and close to its highest recorded price (${formatPrice(highestPrice)}).`;
      advice = `Do not buy at peak. We strongly recommend setting an alert for ${formatPrice(Math.round(avgPrice * 0.95))} or lower.`;
    }

    const recommendedTargetPrice = Math.round(
      lowestPrice > 0 ? Math.min(currentPrice * 0.9, lowestPrice * 1.02) : currentPrice * 0.9
    );

    return {
      currentPrice,
      mrp,
      lowestPrice,
      highestPrice,
      avgPrice,
      dropFromPeak,
      dropFromPeakPct,
      diffFromAvg,
      diffFromAvgPct,
      discountFromMrp,
      discountFromMrpPct,
      isBaselineOnly,
      positionPct,
      score,
      verdict: {
        className: verdictClass,
        badgeText,
        headline,
        summary,
        advice,
        recommendedTargetPrice
      }
    };
  }

  /**
   * Renders the visual horizontal price gauge (ATL to Peak)
   */
  function renderPricePositionMeterHtml(analytics) {
    const { lowestPrice, highestPrice, currentPrice, positionPct, verdict } = analytics;
    const isAtLow = positionPct <= 10;
    const isAtHigh = positionPct >= 90;

    let pinColor = '#4f46e5';
    let pinLabel = 'Current';
    if (isAtLow) {
      pinColor = '#10b981';
      pinLabel = '🔥 Best';
    } else if (isAtHigh) {
      pinColor = '#ef4444';
      pinLabel = '⚠️ High';
    } else if (positionPct < 45) {
      pinColor = '#059669';
      pinLabel = '⚡ Good';
    } else {
      pinColor = '#d97706';
      pinLabel = 'Fair';
    }

    return `
      <div class="sd-gauge-box">
        <div class="sd-gauge-labels">
          <div class="sd-gauge-col text-left">
            <span class="sd-gauge-tag text-green">● All-Time Low</span>
            <strong class="sd-gauge-val">${formatPrice(lowestPrice)}</strong>
          </div>
          <div class="sd-gauge-col text-center">
            <span class="sd-gauge-tag text-indigo">Current Price</span>
            <strong class="sd-gauge-val" style="color: ${pinColor}; font-size: 13px;">${formatPrice(currentPrice)}</strong>
          </div>
          <div class="sd-gauge-col text-right">
            <span class="sd-gauge-tag text-red">● Peak High</span>
            <strong class="sd-gauge-val">${formatPrice(highestPrice)}</strong>
          </div>
        </div>

        <div class="sd-gauge-track-wrap">
          <div class="sd-gauge-track">
            <div class="sd-gauge-gradient"></div>
            <!-- Pin Marker -->
            <div class="sd-gauge-pin" style="left: ${positionPct}%; border-color: ${pinColor};" title="Current Price: ${formatPrice(currentPrice)} (${positionPct}% of price range)">
              <div class="sd-gauge-pin-core" style="background: ${pinColor};"></div>
              <div class="sd-gauge-pin-tooltip" style="background: ${pinColor};">${pinLabel}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the top-level Price Analytics Advice Card
   */
  function renderPriceAnalyticsHtml(analytics) {
    const { verdict, dropFromPeak, dropFromPeakPct, diffFromAvg, avgPrice, isBaselineOnly } = analytics;

    return `
      <div class="sd-analytics-card ${verdict.className}">
        <div class="sd-analytics-header">
          <div class="sd-analytics-badge">${verdict.badgeText}</div>
          <div class="sd-analytics-score" title="Deal Quality Rating: ${analytics.score}/100">
            <span class="sd-score-num">${analytics.score}</span><span class="sd-score-max">/100</span>
          </div>
        </div>
        <div class="sd-analytics-headline">${verdict.headline}</div>
        <p class="sd-analytics-summary">${verdict.summary}</p>
        <div class="sd-analytics-advice">
          <strong>💡 Smart Advice:</strong> ${verdict.advice}
        </div>
      </div>
    `;
  }

  /**
   * Filters price history by selected range tab ('1M', '3M', '6M', '1Y', 'ALL')
   */
  function filterHistoryByRange(priceHistory = [], range = 'ALL') {
    if (!priceHistory || priceHistory.length === 0) return [];
    const valid = priceHistory
      .filter(p => p && p.price && p.timestamp)
      .map(p => ({
        price: Number(p.price),
        date: new Date(p.timestamp)
      }))
      .sort((a, b) => a.date - b.date);

    if (range === 'ALL' || valid.length <= 2) return valid;

    const now = Date.now();
    let days = 30;
    if (range === '1M') days = 30;
    else if (range === '3M') days = 90;
    else if (range === '6M') days = 180;
    else if (range === '1Y') days = 365;

    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    const filtered = valid.filter(p => p.date.getTime() >= cutoff);

    // If filtered window has fewer than 2 points, include the closest predecessor so the line starts properly
    if (filtered.length < 2 && valid.length >= 2) {
      return valid.slice(-Math.min(5, valid.length));
    }
    return filtered;
  }

  /**
   * Generates pure SVG string for the price history graph
   */
  function generateSvgChart(points = [], options = {}) {
    const width = options.width || 420;
    const height = options.height || 180;
    const padding = { top: 30, right: 30, bottom: 35, left: 58 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (!points || points.length < 2) {
      const current = options.currentPrice || (points[0] ? points[0].price : 0);
      const mrp = options.mrp || current;
      return `
        <svg viewBox="0 0 ${width} ${height}" class="sd-svg-root" style="width:100%; height:auto; display:block;">
          <defs>
            <linearGradient id="baseline-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <!-- Grid line -->
          <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="${padding.left - 8}" y="${padding.top + chartH / 2 + 4}" fill="#64748b" font-size="11" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">${formatPrice(current)}</text>

          <!-- Current baseline line -->
          <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="#7c3aed" stroke-width="2.5" />
          <circle cx="${width - padding.right}" cy="${padding.top + chartH / 2}" r="6" fill="#7c3aed" stroke="#ffffff" stroke-width="2" />
          <circle cx="${width - padding.right}" cy="${padding.top + chartH / 2}" r="9" fill="none" stroke="#7c3aed" stroke-width="1.5" opacity="0.4" class="sd-pulse-ring" />

          <!-- Center Label -->
          <text x="${width / 2}" y="${padding.top + chartH / 2 - 14}" fill="#6d28d9" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">
            📍 Initial Checkpoint: ${formatPrice(current)}
          </text>
          <text x="${width / 2}" y="${height - 10}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">
            Tracking Active • Ongoing daily scans will chart price fluctuations here
          </text>
        </svg>
      `;
    }

    const prices = points.map(p => p.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);

    // Add 8% vertical cushion to prevent line touching outer borders
    const span = rawMax - rawMin;
    const cushion = span > 0 ? span * 0.08 : rawMax * 0.05;
    const minPrice = Math.max(0, rawMin - cushion);
    const maxPrice = rawMax + cushion;
    const priceRange = maxPrice === minPrice ? 1 : (maxPrice - minPrice);

    const minDate = points[0].date.getTime();
    const maxDate = points[points.length - 1].date.getTime();
    const dateRange = maxDate === minDate ? 1 : (maxDate - minDate);

    // Compute coordinate mapping
    const coords = points.map(p => {
      const x = padding.left + ((p.date.getTime() - minDate) / dateRange) * chartW;
      const y = padding.top + chartH - ((p.price - minPrice) / priceRange) * chartH;
      return { x, y, price: p.price, date: p.date };
    });

    // Step-line path builder (faithful to e-commerce price drop history)
    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Horizontal step to current x, then vertical to new price
      pathD += ` L ${coords[i].x} ${coords[i - 1].y} L ${coords[i].x} ${coords[i].y}`;
    }

    // Gradient Area fill path
    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padding.top + chartH} L ${coords[0].x} ${padding.top + chartH} Z`;

    // 3 Grid tiers (Max, Average, Min)
    const avgVal = Math.round((rawMax + rawMin) / 2);
    const avgY = padding.top + chartH - ((avgVal - minPrice) / priceRange) * chartH;
    const minY = padding.top + chartH - ((rawMin - minPrice) / priceRange) * chartH;
    const maxY = padding.top + chartH - ((rawMax - minPrice) / priceRange) * chartH;

    const gridTiersSvg = `
      <!-- Peak High line -->
      <line x1="${padding.left}" y1="${maxY}" x2="${width - padding.right}" y2="${maxY}" stroke="#fecdd3" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padding.left - 6}" y="${maxY + 4}" fill="#e11d48" font-size="10" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">${formatPrice(rawMax)}</text>

      <!-- Average line -->
      <line x1="${padding.left}" y1="${avgY}" x2="${width - padding.right}" y2="${avgY}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padding.left - 6}" y="${avgY + 4}" fill="#64748b" font-size="10" text-anchor="end" font-family="system-ui, sans-serif">${formatPrice(avgVal)}</text>

      <!-- All-Time Low line -->
      <line x1="${padding.left}" y1="${minY}" x2="${width - padding.right}" y2="${minY}" stroke="#a7f3d0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padding.left - 6}" y="${minY + 4}" fill="#059669" font-size="10" font-weight="700" text-anchor="end" font-family="system-ui, sans-serif">${formatPrice(rawMin)}</text>
    `;

    // Key markers: Lowest point and Current point
    const lowestCoord = coords.reduce((prev, curr) => curr.price < prev.price ? curr : prev, coords[0]);
    const currentCoord = coords[coords.length - 1];

    // Date tick marks on X-axis (Start, Middle, End)
    const startStr = formatDate(points[0].date, { short: true });
    const endStr = formatDate(points[points.length - 1].date, { short: true });
    const midIdx = Math.floor(points.length / 2);
    const midStr = points.length > 2 ? formatDate(points[midIdx].date, { short: true }) : '';
    const midX = padding.left + chartW / 2;

    // Interactive scrubber hotspots
    const pointsDataJson = JSON.stringify(coords.map(c => ({
      x: Math.round(c.x),
      y: Math.round(c.y),
      price: c.price,
      dateStr: formatDate(c.date)
    }))).replace(/"/g, '&quot;');

    return `
      <svg viewBox="0 0 ${width} ${height}" class="sd-svg-root" data-points="${pointsDataJson}" style="width:100%; height:auto; overflow:visible; display:block;">
        <defs>
          <linearGradient id="sd-chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.0"/>
          </linearGradient>
          <filter id="sd-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#4f46e5" flood-opacity="0.3"/>
          </filter>
        </defs>

        <!-- Grid Lines & Tiers -->
        ${gridTiersSvg}

        <!-- Gradient Area Fill -->
        <path d="${areaD}" fill="url(#sd-chart-grad)" />

        <!-- Main Stepped Price Line -->
        <path d="${pathD}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#sd-shadow)" />

        <!-- Lowest Price Marker Tag -->
        <g class="sd-marker-lowest">
          <circle cx="${lowestCoord.x}" cy="${lowestCoord.y}" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="2" />
          <rect x="${Math.max(padding.left, lowestCoord.x - 38)}" y="${Math.max(5, lowestCoord.y - 24)}" width="76" height="17" rx="4" fill="#059669" />
          <text x="${Math.max(padding.left, lowestCoord.x - 38) + 38}" y="${Math.max(5, lowestCoord.y - 24) + 12}" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">
            Lowest ${formatPrice(lowestCoord.price)}
          </text>
        </g>

        <!-- Current Price Marker -->
        <g class="sd-marker-current">
          <circle cx="${currentCoord.x}" cy="${currentCoord.y}" r="5" fill="#4f46e5" stroke="#ffffff" stroke-width="2" />
        </g>

        <!-- Interactive Crosshair (hidden by default, updated on hover) -->
        <g class="sd-crosshair-group" style="display: none;">
          <line class="sd-crosshair-line" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + chartH}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="3,3" />
          <circle class="sd-crosshair-dot" cx="0" cy="0" r="5.5" fill="#4f46e5" stroke="#ffffff" stroke-width="2" />
        </g>

        <!-- X-Axis Dates -->
        <line x1="${padding.left}" y1="${height - 22}" x2="${width - padding.right}" y2="${height - 22}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${padding.left}" y="${height - 8}" fill="#64748b" font-size="10" text-anchor="start" font-family="system-ui, sans-serif">${startStr}</text>
        ${midStr ? `<text x="${midX}" y="${height - 8}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">${midStr}</text>` : ''}
        <text x="${width - padding.right}" y="${height - 8}" fill="#64748b" font-size="10" text-anchor="end" font-family="system-ui, sans-serif">${endStr}</text>

        <!-- Transparent Scrub Surface -->
        <rect class="sd-scrub-surface" x="${padding.left}" y="${padding.top}" width="${chartW}" height="${chartH}" fill="transparent" style="cursor: crosshair;" />
      </svg>
    `;
  }

  /**
   * Complete Interactive Chart Component with Time Range Pills & Live Tooltip
   */
  function renderPriceHistorySvg(priceHistory = [], options = {}) {
    const rawHistory = Array.isArray(priceHistory) ? priceHistory : [];
    const activeRange = options.range || 'ALL';
    const filteredPoints = filterHistoryByRange(rawHistory, activeRange);
    const svgContent = generateSvgChart(filteredPoints, options);

    const hasMultiple = rawHistory.length >= 2;

    return `
      <div class="sd-chart-box" data-active-range="${activeRange}">
        <!-- Top Toolbar: Title & Range Selector Tabs -->
        <div class="sd-chart-toolbar">
          <div class="sd-chart-heading">
            <span class="sd-chart-icon">📈</span>
            <span class="sd-chart-title-text">Price History Graph</span>
          </div>

          ${hasMultiple ? `
            <div class="sd-range-tabs">
              <button class="sd-range-btn ${activeRange === '1M' ? 'active' : ''}" data-range="1M">1M</button>
              <button class="sd-range-btn ${activeRange === '3M' ? 'active' : ''}" data-range="3M">3M</button>
              <button class="sd-range-btn ${activeRange === '6M' ? 'active' : ''}" data-range="6M">6M</button>
              <button class="sd-range-btn ${activeRange === '1Y' ? 'active' : ''}" data-range="1Y">1Y</button>
              <button class="sd-range-btn ${activeRange === 'ALL' ? 'active' : ''}" data-range="ALL">All</button>
            </div>
          ` : ''}
        </div>

        <!-- SVG Chart Container with Floating Tooltip -->
        <div class="sd-chart-stage" style="position: relative; width: 100%;">
          ${svgContent}

          <!-- Floating Scrub Tooltip -->
          <div class="sd-chart-tooltip" style="display: none; position: absolute; pointer-events: none; z-index: 20;">
            <div class="sd-tip-date"></div>
            <div class="sd-tip-price"></div>
            <div class="sd-tip-note"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attaches interactive mouse scrubbing, crosshairs, tooltips, and range tabs
   * to a rendered chart element (supports Shadow DOM and standard DOM).
   */
  function attachChartListeners(chartContainer, rawHistory = [], options = {}, onRangeChange = null) {
    if (!chartContainer) return;

    // 1. Time Range Selector Clicks
    const rangeButtons = chartContainer.querySelectorAll('.sd-range-btn');
    rangeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedRange = btn.getAttribute('data-range');
        if (typeof onRangeChange === 'function') {
          onRangeChange(selectedRange);
        } else {
          // Default internal re-render
          const updatedHtml = renderPriceHistorySvg(rawHistory, { ...options, range: selectedRange });
          chartContainer.innerHTML = updatedHtml;
          attachChartListeners(chartContainer, rawHistory, { ...options, range: selectedRange }, onRangeChange);
        }
      });
    });

    // 2. Interactive Crosshair Scrubbing
    const svgRoot = chartContainer.querySelector('.sd-svg-root');
    const scrubSurface = chartContainer.querySelector('.sd-scrub-surface');
    const tooltip = chartContainer.querySelector('.sd-chart-tooltip');
    const crosshairGroup = chartContainer.querySelector('.sd-crosshair-group');
    const crosshairLine = chartContainer.querySelector('.sd-crosshair-line');
    const crosshairDot = chartContainer.querySelector('.sd-crosshair-dot');

    if (!svgRoot || !scrubSurface || !tooltip || !crosshairGroup) return;

    let pointsData = [];
    try {
      const rawAttr = svgRoot.getAttribute('data-points');
      if (rawAttr) {
        pointsData = JSON.parse(rawAttr);
      }
    } catch (e) {}

    if (!pointsData || pointsData.length === 0) return;

    function handleMove(clientX, clientY) {
      const rect = svgRoot.getBoundingClientRect();
      const relX = clientX - rect.left;
      const scaleX = 420 / rect.width;
      const svgX = relX * scaleX;

      // Find closest point to current X
      let closest = pointsData[0];
      let minDiff = Infinity;
      for (const pt of pointsData) {
        const diff = Math.abs(pt.x - svgX);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pt;
        }
      }

      if (!closest) return;

      // Position crosshair
      crosshairGroup.style.display = 'block';
      crosshairLine.setAttribute('x1', closest.x);
      crosshairLine.setAttribute('x2', closest.x);
      crosshairDot.setAttribute('cx', closest.x);
      crosshairDot.setAttribute('cy', closest.y);

      // Position tooltip in HTML space
      const screenX = (closest.x / 420) * rect.width;
      const screenY = (closest.y / 180) * rect.height;

      tooltip.style.display = 'block';
      tooltip.querySelector('.sd-tip-date').textContent = closest.dateStr;
      tooltip.querySelector('.sd-tip-price').textContent = formatPrice(closest.price);

      // Calculate relative note
      const allPrices = pointsData.map(p => p.price);
      const minP = Math.min(...allPrices);
      const maxP = Math.max(...allPrices);
      const noteEl = tooltip.querySelector('.sd-tip-note');

      if (closest.price <= minP) {
        noteEl.textContent = '🔥 Lowest Price!';
        noteEl.style.color = '#10b981';
      } else if (closest.price >= maxP) {
        noteEl.textContent = 'Peak Price';
        noteEl.style.color = '#f43f5e';
      } else {
        noteEl.textContent = `${formatPrice(closest.price - minP)} above lowest`;
        noteEl.style.color = '#94a3b8';
      }

      // Constrain tooltip within card edges
      const tipWidth = 120;
      let left = screenX - (tipWidth / 2);
      if (left < 10) left = 10;
      if (left + tipWidth > rect.width - 10) left = rect.width - tipWidth - 10;

      let top = screenY - 60;
      if (top < 5) top = screenY + 15;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function handleLeave() {
      crosshairGroup.style.display = 'none';
      tooltip.style.display = 'none';
    }

    scrubSurface.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    scrubSurface.addEventListener('mouseleave', handleLeave);

    scrubSurface.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    scrubSurface.addEventListener('touchend', handleLeave);
  }

  return {
    formatPrice,
    formatDate,
    computePriceAnalytics,
    renderPricePositionMeterHtml,
    renderPriceAnalyticsHtml,
    renderPriceHistorySvg,
    attachChartListeners
  };
});
