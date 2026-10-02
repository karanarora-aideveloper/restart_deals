'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { formatInr } from '@/lib/affiliate';
import { computePriceStats } from '@/lib/priceAnalytics';
import { trackPriceHistoryInteraction } from '@/lib/analytics';

/**
 * High-Precision Interactive E-Commerce Price History Chart
 * Uses plateau step-lines, adaptive vertical scaling, milestone indicators,
 * and a synchronized live inspection scrubber.
 */
export default function PriceHistoryChart({ product, priceStats }) {
  const [timeRange, setTimeRange] = useState('3M'); // '1M' | '3M' | '6M' | '1Y' | 'ALL'
  const [chartMode, setChartMode] = useState('steps'); // 'steps' | 'smooth'
  const [hoveredPlateau, setHoveredPlateau] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  const svgRef = useRef(null);

  const productCountry = product?.country || 'IN';

  // 1. Normalize and deduplicate history data points
  const rawHistory = useMemo(() => {
    const list = Array.isArray(product?.priceHistory) ? [...product.priceHistory] : [];
    if (product?.price && (list.length === 0 || list[list.length - 1]?.price !== product.price)) {
      list.push({
        price: product.price,
        originalPrice: product.originalPrice,
        timestamp: product.priceUpdatedAt || new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
    }
    return list
      .filter((h) => h && h.price && !isNaN(Number(h.price)) && Number(h.price) > 0)
      .map((h) => ({
        price: Number(h.price),
        originalPrice: Number(h.originalPrice) || Number(product?.originalPrice) || Number(h.price),
        date: h.date || new Date(h.timestamp || Date.now()).toISOString().split('T')[0],
        timestamp: new Date(h.timestamp || h.date || Date.now()).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [product]);

  // 2. Filter by selected time range
  const filteredHistory = useMemo(() => {
    if (rawHistory.length <= 1 || timeRange === 'ALL') return rawHistory;
    const now = Date.now();
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const cutoff = now - (daysMap[timeRange] || 90) * 86400000;
    const filtered = rawHistory.filter((h) => h.timestamp >= cutoff);
    return filtered.length > 0 ? filtered : rawHistory;
  }, [rawHistory, timeRange]);

  // 3. Consolidate consecutive identical price days into plateaus
  const plateaus = useMemo(() => {
    if (filteredHistory.length === 0) return [];
    const list = [];
    let cur = null;

    for (const h of filteredHistory) {
      if (!cur) {
        cur = {
          price: h.price,
          originalPrice: h.originalPrice,
          startTs: h.timestamp,
          endTs: h.timestamp,
          startDate: h.date,
          endDate: h.date,
          count: 1,
        };
      } else if (cur.price === h.price) {
        cur.endTs = h.timestamp;
        cur.endDate = h.date;
        cur.count += 1;
      } else {
        list.push(cur);
        cur = {
          price: h.price,
          originalPrice: h.originalPrice,
          startTs: h.timestamp,
          endTs: h.timestamp,
          startDate: h.date,
          endDate: h.date,
          count: 1,
        };
      }
    }
    if (cur) list.push(cur);

    // If only 1 plateau, expand time window so horizontal line spans nicely
    if (list.length === 1) {
      const p = list[0];
      p.startTs = p.startTs - 86400000 * 7;
    }

    return list;
  }, [filteredHistory]);

  // 4. Derive overall price metrics
  const stats = useMemo(() => {
    if (priceStats && priceStats.lowestPrice) return priceStats;
    return computePriceStats({
      ...product,
      priceHistory: rawHistory,
    });
  }, [rawHistory, priceStats, product]);

  const lowestEntry = useMemo(() => {
    if (rawHistory.length === 0) return null;
    return rawHistory.reduce((prev, curr) => (curr.price < prev.price ? curr : prev), rawHistory[0]);
  }, [rawHistory]);

  const highestEntry = useMemo(() => {
    if (rawHistory.length === 0) return null;
    return rawHistory.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), rawHistory[0]);
  }, [rawHistory]);

  // 5. Chart dimensions & adaptive scaling
  const chartWidth = 720;
  const chartHeight = 260;
  const pad = { top: 32, bottom: 40, left: 65, right: 35 };
  const plotWidth = chartWidth - pad.left - pad.right;
  const plotHeight = chartHeight - pad.top - pad.bottom;

  const { minTs, maxTs, timeSpan, yMin, yMax, ySpan, yTicks, mrpY } = useMemo(() => {
    if (plateaus.length === 0) {
      return {
        minTs: Date.now() - 86400000,
        maxTs: Date.now(),
        timeSpan: 86400000,
        yMin: 0,
        yMax: 100,
        ySpan: 100,
        yTicks: [],
        mrpY: null,
      };
    }

    const tStart = plateaus[0].startTs;
    const tEnd = plateaus[plateaus.length - 1].endTs || Date.now();
    const tSpan = Math.max(86400000, tEnd - tStart);

    const prices = plateaus.map((pl) => pl.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const rawMrp = Number(product?.originalPrice) || 0;

    // Prevent small price fluctuations from looking like violent 80% cliffs:
    // Expand vertical scale with at least 25% padding or 15% of price magnitude
    const priceSpread = maxP - minP;
    const padding = Math.max(priceSpread * 0.35, maxP * 0.12, 100);

    // Calculate clean rounded tick step
    const rawSpan = maxP - minP + padding * 2;
    let step = 500;
    if (rawSpan > 20000) step = 5000;
    else if (rawSpan > 10000) step = 2000;
    else if (rawSpan > 4000) step = 1000;
    else if (rawSpan > 1500) step = 500;
    else if (rawSpan > 500) step = 200;
    else step = 50;

    const computedYMin = Math.max(0, Math.floor((minP - padding) / step) * step);
    let computedYMax = Math.ceil((maxP + padding) / step) * step;

    // If MRP is valid and within 2.2x of max price, include MRP inside top bounds
    let computedMrpY = null;
    if (rawMrp > maxP && rawMrp <= maxP * 2.2) {
      if (rawMrp > computedYMax) {
        computedYMax = Math.ceil(rawMrp / step) * step;
      }
    }

    const computedYSpan = Math.max(1, computedYMax - computedYMin);

    // Generate 4 clean horizontal grid ticks
    const ticks = [];
    const tickCount = 4;
    for (let i = 0; i <= tickCount; i++) {
      const val = Math.round(computedYMin + (computedYSpan / tickCount) * i);
      const yPos = pad.top + plotHeight - ((val - computedYMin) / computedYSpan) * plotHeight;
      ticks.push({ value: val, y: yPos });
    }

    if (rawMrp > maxP && rawMrp <= computedYMax) {
      computedMrpY = pad.top + plotHeight - ((rawMrp - computedYMin) / computedYSpan) * plotHeight;
    }

    return {
      minTs: tStart,
      maxTs: tEnd,
      timeSpan: tSpan,
      yMin: computedYMin,
      yMax: computedYMax,
      ySpan: computedYSpan,
      yTicks: ticks,
      mrpY: computedMrpY,
    };
  }, [plateaus, product?.originalPrice, plotHeight, pad.top]);

  // Coordinate projection helpers
  const getX = useCallback(
    (ts) => pad.left + Math.max(0, Math.min(1, (ts - minTs) / timeSpan)) * plotWidth,
    [minTs, timeSpan, plotWidth, pad.left]
  );

  const getY = useCallback(
    (price) => pad.top + plotHeight - Math.max(0, Math.min(1, (price - yMin) / ySpan)) * plotHeight,
    [yMin, ySpan, plotHeight, pad.top]
  );

  // 6. Map plateaus with precomputed SVG coordinates
  const mappedPlateaus = useMemo(() => {
    return plateaus.map((pl) => {
      const x1 = getX(pl.startTs);
      const x2 = getX(pl.endTs);
      const y = getY(pl.price);
      return {
        ...pl,
        x1,
        x2,
        y,
        midX: (x1 + x2) / 2,
      };
    });
  }, [plateaus, getX, getY]);

  // 7. Generate Step-Line & Smooth-Line SVG Paths
  const { linePath, areaPath } = useMemo(() => {
    if (mappedPlateaus.length === 0) return { linePath: '', areaPath: '' };

    const bottomY = pad.top + plotHeight;
    const firstX = mappedPlateaus[0].x1;
    const lastX = mappedPlateaus[mappedPlateaus.length - 1].x2;

    if (chartMode === 'steps') {
      let d = `M ${mappedPlateaus[0].x1.toFixed(1)} ${mappedPlateaus[0].y.toFixed(1)}`;
      for (let i = 0; i < mappedPlateaus.length; i++) {
        const pl = mappedPlateaus[i];
        if (i === 0) {
          d += ` L ${pl.x2.toFixed(1)} ${pl.y.toFixed(1)}`;
        } else {
          // Vertical step to new price at x1, then horizontal plateau to x2
          d += ` L ${pl.x1.toFixed(1)} ${pl.y.toFixed(1)} L ${pl.x2.toFixed(1)} ${pl.y.toFixed(1)}`;
        }
      }
      const area = `${d} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
      return { linePath: d, areaPath: area };
    }

    // Smooth mode: monotone cubic interpolation across midpoints
    const midPoints = mappedPlateaus.map((p) => ({ x: p.midX, y: p.y }));
    if (midPoints.length === 1) {
      const d = `M ${firstX} ${midPoints[0].y} L ${lastX} ${midPoints[0].y}`;
      const area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
      return { linePath: d, areaPath: area };
    }

    let d = `M ${firstX.toFixed(1)} ${midPoints[0].y.toFixed(1)}`;
    for (let i = 0; i < midPoints.length - 1; i++) {
      const p0 = midPoints[i];
      const p1 = midPoints[i + 1];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx.toFixed(1)} ${p0.y.toFixed(1)}, ${cpx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    d += ` L ${lastX.toFixed(1)} ${midPoints[midPoints.length - 1].y.toFixed(1)}`;
    const area = `${d} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
    return { linePath: d, areaPath: area };
  }, [mappedPlateaus, chartMode, pad.top, plotHeight]);

  // 8. Find lowest price plateau in currently mapped range
  const lowestMapped = useMemo(() => {
    if (mappedPlateaus.length === 0) return null;
    return mappedPlateaus.reduce((min, curr) => (curr.price < min.price ? curr : min), mappedPlateaus[0]);
  }, [mappedPlateaus]);

  // 9. Generate 5 evenly spaced X-axis Date Markers
  const xDateTicks = useMemo(() => {
    if (plateaus.length === 0) return [];
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const t = minTs + (timeSpan / count) * i;
      const x = pad.left + (plotWidth / count) * i;
      const dObj = new Date(t);
      const label = dObj.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      ticks.push({ x, label });
    }
    return ticks;
  }, [minTs, timeSpan, plotWidth, pad.left, plateaus.length]);

  // 10. Mouse/Touch scrub handler
  const handlePointerMove = useCallback(
    (clientX) => {
      if (!svgRef.current || mappedPlateaus.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const svgX = (relX / rect.width) * chartWidth;
      const clampedX = Math.max(pad.left, Math.min(chartWidth - pad.right, svgX));

      // Find the plateau whose interval [x1, x2] contains svgX, or the nearest one
      let matched = null;
      for (const pl of mappedPlateaus) {
        if (clampedX >= pl.x1 && clampedX <= pl.x2) {
          matched = pl;
          break;
        }
      }
      if (!matched) {
        let minD = Infinity;
        for (const pl of mappedPlateaus) {
          const d = Math.min(Math.abs(clampedX - pl.x1), Math.abs(clampedX - pl.x2));
          if (d < minD) {
            minD = d;
            matched = pl;
          }
        }
      }

      setHoveredPlateau(matched || mappedPlateaus[mappedPlateaus.length - 1]);
      setCursorX(clampedX);
    },
    [mappedPlateaus, chartWidth, pad.left, pad.right]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredPlateau(null);
    setCursorX(null);
  }, []);

  // Format active inspection details
  const activeInspector = useMemo(() => {
    const active = hoveredPlateau || mappedPlateaus[mappedPlateaus.length - 1];
    if (!active) return null;

    const isCurrent = active.endDate === mappedPlateaus[mappedPlateaus.length - 1]?.endDate;
    const isLowestEver = stats?.lowestPrice && active.price === stats.lowestPrice;
    const priceDiff = active.price - (stats?.currentPrice || active.price);

    let contextBadge = 'Current Selling Price';
    if (isLowestEver) {
      contextBadge = '🟢 All-Time Lowest Price';
    } else if (priceDiff < 0) {
      contextBadge = `🟢 Save ${formatInr(Math.abs(priceDiff), productCountry)} vs Today`;
    } else if (priceDiff > 0) {
      contextBadge = `🔴 ${formatInr(priceDiff, productCountry)} above today`;
    } else if (isCurrent) {
      contextBadge = '🟢 Active Current Price';
    }

    const startStr = new Date(active.startDate).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const endStr = new Date(active.endDate).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const dateRangeLabel =
      active.startDate === active.endDate
        ? `📅 ${startStr}`
        : `📅 ${startStr} – ${endStr} (${active.count} ${active.count === 1 ? 'day' : 'days'})`;

    const mrp = Number(product?.originalPrice) || active.originalPrice;
    const discountPct = mrp > active.price ? Math.round(((mrp - active.price) / mrp) * 100) : 0;

    return {
      price: active.price,
      originalPrice: mrp,
      dateLabel: dateRangeLabel,
      contextBadge,
      discountPct,
      y: active.y,
    };
  }, [hoveredPlateau, mappedPlateaus, stats, productCountry, product?.originalPrice]);

  const getVerdictStyle = (v) => {
    if (v === 'BUY_NOW') return 'border-emerald-200 bg-emerald-50/80 text-emerald-900';
    if (v === 'GOOD_PRICE') return 'border-sky-200 bg-sky-50/80 text-sky-900';
    if (v === 'WAIT') return 'border-amber-200 bg-amber-50/80 text-amber-900';
    return 'border-gray-200 bg-gray-50 text-gray-800';
  };

  return (
    <div className="rounded-3xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* 1. Buying Recommendation Verdict Banner */}
      <div
        className={`mb-5 flex flex-col gap-1.5 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${getVerdictStyle(
          stats.verdict
        )}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold">{stats.verdictTitle}</span>
        </div>
        <p className="text-xs font-semibold sm:text-right">{stats.verdictReason}</p>
      </div>

      {/* 2. Key Price Metrics Stat Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Current Price */}
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Current Price</span>
          <p className="mt-1 text-xl font-black text-brand">{formatInr(stats.currentPrice, productCountry)}</p>
        </div>

        {/* Lowest Ever */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">🟢 Lowest Ever</span>
          <p className="mt-1 text-xl font-black text-emerald-800">{formatInr(stats.lowestPrice, productCountry)}</p>
          {lowestEntry && (
            <p className="mt-0.5 text-[10px] font-medium text-emerald-600" suppressHydrationWarning>
              {new Date(lowestEntry.timestamp).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          )}
        </div>

        {/* Highest Price */}
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/60 p-3.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">🔴 Highest Price</span>
          <p className="mt-1 text-xl font-black text-rose-800">{formatInr(stats.highestPrice, productCountry)}</p>
          {highestEntry && (
            <p className="mt-0.5 text-[10px] font-medium text-rose-600" suppressHydrationWarning>
              {new Date(highestEntry.timestamp).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          )}
        </div>

        {/* Average Price */}
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">🟡 Average Price</span>
          <p className="mt-1 text-xl font-black text-gray-900">{formatInr(stats.averagePrice, productCountry)}</p>
        </div>
      </div>

      {/* 3. Header, Mode Toggle & Time Range Selector */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-gray-900">Price Trend & History</h3>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              Step History
            </span>
          </div>
          <p className="text-[11px] font-medium text-gray-400 mt-0.5">
            Verified store price transitions over time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Step / Smooth Toggle */}
          <div className="flex items-center rounded-xl border border-gray-200 bg-gray-100 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setChartMode('steps')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                chartMode === 'steps' ? 'bg-white text-gray-900 shadow-2xs font-extrabold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              🪜 Steps
            </button>
            <button
              type="button"
              onClick={() => setChartMode('smooth')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                chartMode === 'smooth' ? 'bg-white text-gray-900 shadow-2xs font-extrabold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              📈 Smooth
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setTimeRange(r);
                  trackPriceHistoryInteraction(product, r, isAllTimeLow);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition-all ${
                  timeRange === r ? 'bg-white text-brand shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Live Scrubber Inspector Bar */}
      {activeInspector && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/30 p-3 shadow-2xs transition-all">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-gray-500 block truncate">
              {activeInspector.dateLabel}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-brand tracking-tight">
                {formatInr(activeInspector.price, productCountry)}
              </span>
              {activeInspector.originalPrice > activeInspector.price && (
                <span className="text-xs text-gray-400 line-through">
                  MRP {formatInr(activeInspector.originalPrice, productCountry)}
                </span>
              )}
              {activeInspector.discountPct > 0 && (
                <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-2xs">
                  {activeInspector.discountPct}% OFF
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs">
              {activeInspector.contextBadge}
            </span>
          </div>
        </div>
      )}

      {/* 5. Modern Interactive SVG Canvas with Adaptive Step Path */}
      <div
        className="group relative w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-gradient-to-b from-gray-50/70 to-white p-3 shadow-inner select-none cursor-crosshair touch-pan-x"
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={handlePointerLeave}
        onTouchMove={(e) => {
          if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX);
          }
        }}
        onTouchEnd={handlePointerLeave}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[250px] sm:h-[280px] w-full touch-none"
        >
          <defs>
            {/* Clean Orange Area Gradient */}
            <linearGradient id="stepAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.22" />
              <stop offset="80%" stopColor="#ff6b00" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.0" />
            </linearGradient>

            {/* Subtle glow for the main step line */}
            <filter id="cleanGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#ff6b00" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={pad.left}
                y1={tick.y}
                x2={chartWidth - pad.right}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[11px] font-semibold"
              >
                ₹{tick.value >= 1000 ? `${(tick.value / 1000).toFixed(tick.value % 1000 === 0 ? 0 : 1)}k` : tick.value}
              </text>
            </g>
          ))}

          {/* Statutory MRP Benchmark Reference Line (if in range) */}
          {mrpY !== null && (
            <g>
              <line
                x1={pad.left}
                y1={mrpY}
                x2={chartWidth - pad.right}
                y2={mrpY}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                strokeWidth="1.2"
                opacity="0.7"
              />
              <text
                x={chartWidth - pad.right}
                y={mrpY - 5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-bold tracking-wide"
              >
                MRP Benchmark: {formatInr(product?.originalPrice, productCountry)}
              </text>
            </g>
          )}

          {/* Area Fill Underneath */}
          <path d={areaPath} fill="url(#stepAreaGradient)" />

          {/* The Master Price Step Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#ff6b00"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#cleanGlow)"
          />

          {/* All-Time Lowest Anchor Badge in View */}
          {lowestMapped && (
            <g className="transition-all duration-200">
              <circle
                cx={lowestMapped.midX}
                y={lowestMapped.y}
                r="5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <rect
                x={lowestMapped.midX - 35}
                y={lowestMapped.y - 25}
                width="70"
                height="18"
                rx="6"
                fill="#10b981"
                className="shadow-xs"
              />
              <text
                x={lowestMapped.midX}
                y={lowestMapped.y - 13}
                textAnchor="middle"
                className="fill-white text-[9.5px] font-black tracking-tight"
              >
                Lowest ₹{lowestMapped.price >= 1000 ? `${(lowestMapped.price / 1000).toFixed(1)}k` : lowestMapped.price}
              </text>
            </g>
          )}

          {/* Current Rightmost Anchor Dot */}
          {mappedPlateaus.length > 0 && (
            <circle
              cx={mappedPlateaus[mappedPlateaus.length - 1].x2}
              cy={mappedPlateaus[mappedPlateaus.length - 1].y}
              r="4.5"
              fill="#ff6b00"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
          )}

          {/* Interactive Dynamic Vertical Scrubber Line & Dot */}
          {cursorX !== null && hoveredPlateau && (
            <g className="transition-opacity duration-100">
              <line
                x1={cursorX}
                y1={pad.top}
                x2={cursorX}
                y2={pad.top + plotHeight}
                stroke="#ff6b00"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.9"
              />
              <circle
                cx={cursorX}
                cy={hoveredPlateau.y}
                r="6.5"
                fill="#ffffff"
                stroke="#ff6b00"
                strokeWidth="3.5"
                className="shadow-md"
              />
            </g>
          )}

          {/* X-Axis Calendar Date Markings */}
          {xDateTicks.map((t, idx) => (
            <text
              key={idx}
              x={t.x}
              y={chartHeight - 12}
              textAnchor="middle"
              className="fill-gray-400 text-[10px] font-bold"
            >
              {t.label}
            </text>
          ))}
        </svg>
      </div>

      {/* 6. Footer Usage Guide */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5 font-medium">
          <span>👆</span> Hover or drag across the chart to inspect verified historical price levels
        </span>
        <span className="font-semibold text-gray-400">
          🕒 24h Synchronized Continuous Price Tracker
        </span>
      </div>
    </div>
  );
}
