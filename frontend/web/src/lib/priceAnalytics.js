/**
 * Computes historical price statistics, authentic price drops, and truth verdicts.
 * 
 * CORE TRUTH PRINCIPLE:
 * Printed MRP (originalPrice) in Indian e-commerce is overwhelmingly marketing fiction
 * (e.g. ₹27,412 printed MRP on a ₹4,000 trolley, or ₹99,999 MRP on a ₹31,000 appliance).
 * ShoppersDeals NEVER presents inflated MRP discounts as genuine price drops.
 *
 * An authentic "Price Drop" is strictly measured against the actual previous selling price
 * and 30-day historical average.
 *
 * @param {Object} product - Product/Deal object with price/dealPrice, originalPrice, previousPrice, priceHistory
 * @returns {Object} priceStats
 */
export function computePriceStats(product) {
  if (!product) return null;

  const currentPrice = Number(product.price ?? product.dealPrice) || 0;
  const originalPrice = Number(product.originalPrice) || 0; // Statutory List Price / MRP
  const previousPrice = Number(product.previousPrice) || 0; // Authentic previous selling price
  const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];

  // Collect all recorded prices in history
  const recordedPrices = history
    .map((h) => Number(h.price))
    .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);

  if (currentPrice > 0 && !recordedPrices.includes(currentPrice)) {
    recordedPrices.push(currentPrice);
  }

  // Fallback if no prices recorded
  if (recordedPrices.length === 0) {
    const mrpDiscountAmount = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
    const mrpDiscountPct = originalPrice > currentPrice ? Math.round((mrpDiscountAmount / originalPrice) * 100) : 0;

    return {
      currentPrice,
      originalPrice,
      previousPrice: null,
      lowestPrice: currentPrice || originalPrice,
      highestPrice: originalPrice || currentPrice,
      averagePrice: currentPrice || originalPrice,
      totalPricePoints: 0,
      realPriceDrop: 0,
      realPriceDropPct: 0,
      hasRealPriceDrop: false,
      mrpDiscountAmount,
      mrpDiscountPct,
      priceDropPct: mrpDiscountPct,
      pricePositionPct: 50,
      verdict: 'FAIR_PRICE',
      verdictTitle: '⚖️ Standard Price',
      verdictReason: 'Tracking started recently. No historical price changes recorded yet.',
      badgeText: 'New Tracked',
      isAllTimeLow: false,
      isRealPriceDrop: false,
      isFakeMrpDiscount: false,
      isBelowAverage: false,
      isAboveAverage: false,
      dropProbabilityPct: 50,
      dropProbabilityLabel: 'Moderate (50%)',
      dropAdvice: 'Tracking started recently. Set an alert to catch the next price drop.',
      dealAction: 'FAIR',
      dealScore: 6.0,
      expectedDropPrice: currentPrice || originalPrice,
      expectedSavings: 0,
    };
  }

  const lowestPrice = Math.min(...recordedPrices);
  const highestPrice = Math.max(...recordedPrices);
  const sum = recordedPrices.reduce((acc, p) => acc + p, 0);
  const averagePrice = Math.round(sum / recordedPrices.length);

  // Percentile position: 0% = at all-time lowest, 100% = at all-time highest
  let pricePositionPct = 50;
  if (highestPrice > lowestPrice) {
    pricePositionPct = Math.min(100, Math.max(0, Math.round(((currentPrice - lowestPrice) / (highestPrice - lowestPrice)) * 100)));
  }

  // 1. Authentic Price Drop against Previous Selling Price
  const hasRealPreviousPrice = previousPrice > 0 && previousPrice !== currentPrice;
  const realPriceDrop = hasRealPreviousPrice && previousPrice > currentPrice ? previousPrice - currentPrice : 0;
  const realPriceDropPct = hasRealPreviousPrice && previousPrice > currentPrice ? Math.round((realPriceDrop / previousPrice) * 100) : 0;
  const hasRealPriceDrop = realPriceDropPct >= 2;

  // 2. Statutory MRP Discount
  const mrpDiscountAmount = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const mrpDiscountPct = originalPrice > currentPrice ? Math.round((mrpDiscountAmount / originalPrice) * 100) : 0;

  // 3. Fake Discount Detector:
  // When a store displays e.g. "60% OFF" off an inflated MRP, but the product sells at
  // or above its 30-day average selling price.
  const isFakeMrpDiscount = Boolean(
    mrpDiscountPct >= 30 &&
    recordedPrices.length >= 2 &&
    currentPrice >= averagePrice * 0.98 &&
    !hasRealPriceDrop
  );

  // 4. Determine Truth Verdicts (Decision #19: All-Time Low strictly requires >=30 daily checkpoints)
  const isAllTimeLow = recordedPrices.length >= 30 && currentPrice <= lowestPrice * 1.01;
  const isBelowAverage = averagePrice > 0 && currentPrice <= averagePrice * 0.94;
  const isAboveAverage = averagePrice > 0 && currentPrice >= averagePrice * 1.08;

  let verdict = 'FAIR_PRICE';
  let verdictTitle = '⚖️ Standard Everyday Price';
  let verdictReason = 'Current price is within normal historical fluctuation range.';
  let badgeText = '⚖️ Fair Price';

  if (isAllTimeLow) {
    verdict = 'ALL_TIME_LOW';
    verdictTitle = '🔥 All-Time Lowest Price Ever!';
    verdictReason = `Price is at its absolute lowest recorded level (₹${currentPrice.toLocaleString('en-IN')}). Authentic rock-bottom!`;
    badgeText = '📉 All-Time Low';
  } else if (hasRealPriceDrop && realPriceDropPct >= 5) {
    verdict = 'REAL_PRICE_DROP';
    verdictTitle = `📉 Genuine Drop of ₹${realPriceDrop.toLocaleString('en-IN')}`;
    verdictReason = `Authentic price drop! Was selling for ₹${previousPrice.toLocaleString('en-IN')} previously. Dropped by ${realPriceDropPct}%.`;
    badgeText = `📉 ₹${realPriceDrop.toLocaleString('en-IN')} True Drop`;
  } else if (isBelowAverage) {
    verdict = 'BELOW_AVERAGE';
    verdictTitle = '✅ Below 30-Day Average';
    verdictReason = `Current price is ₹${(averagePrice - currentPrice).toLocaleString('en-IN')} below the historical average selling price (₹${averagePrice.toLocaleString('en-IN')}).`;
    badgeText = '✅ Below Avg';
  } else if (isFakeMrpDiscount) {
    verdict = 'FAKE_MRP_DISCOUNT';
    verdictTitle = '⚠️ Everyday Price (Inflated MRP)';
    verdictReason = `The ${mrpDiscountPct}% MRP discount is retailer marketing. This product regularly sells around ₹${averagePrice.toLocaleString('en-IN')}.`;
    badgeText = '⚠️ Everyday Price';
  } else if (isAboveAverage) {
    verdict = 'ABOVE_AVERAGE';
    verdictTitle = '⏳ Wait for Drop';
    verdictReason = `Price is ₹${(currentPrice - averagePrice).toLocaleString('en-IN')} higher than historical average. It frequently drops lower.`;
    badgeText = '⏳ Price High';
  }

  // 5. Buyhatke-Benchmark "Buy Now vs. Wait" Price Drop Probability & Deal Scoring Engine
  let dropProbabilityPct = 50;
  let dropProbabilityLabel = 'Moderate (50%)';
  let dropAdvice = 'Fair everyday price. May drop during upcoming festival sales.';
  let dealAction = 'FAIR';
  let dealScore = 6.0;

  if (isAllTimeLow || pricePositionPct <= 10) {
    dropProbabilityPct = 12;
    dropProbabilityLabel = 'Very Low (12%)';
    dropAdvice = 'Great time to buy! Price is at/near all-time low with very low probability of dropping further soon.';
    dealAction = 'BUY_NOW';
    dealScore = isAllTimeLow ? 9.8 : 9.2;
  } else if (hasRealPriceDrop && realPriceDropPct >= 8) {
    dropProbabilityPct = 20;
    dropProbabilityLabel = 'Low (20%)';
    dropAdvice = `Genuine price drop of ${realPriceDropPct}%! Strong buying opportunity.`;
    dealAction = 'BUY_NOW';
    dealScore = Math.min(9.5, 8.5 + (realPriceDropPct / 20));
  } else if (isBelowAverage || pricePositionPct <= 35) {
    dropProbabilityPct = 28;
    dropProbabilityLabel = 'Low (28%)';
    dropAdvice = 'Good price! Selling below the 30-day historical average. Good time to buy.';
    dealAction = 'BUY_NOW';
    dealScore = 8.0;
  } else if (isAboveAverage || pricePositionPct >= 75) {
    dropProbabilityPct = 85;
    dropProbabilityLabel = 'High (85%)';
    dropAdvice = 'High chance of price drop! Currently above historical average. We recommend waiting or setting a price alert.';
    dealAction = 'WAIT';
    dealScore = Math.max(2.0, Math.round(((100 - pricePositionPct) / 10) * 10) / 10);
  } else {
    dropProbabilityPct = 52;
    dropProbabilityLabel = 'Moderate (52%)';
    dropAdvice = 'Fair everyday price within normal fluctuation range.';
    dealAction = 'FAIR';
    dealScore = Math.max(4.0, Math.min(7.0, Math.round(((100 - pricePositionPct) / 10) * 10) / 10));
  }

  const expectedDropPrice = currentPrice > lowestPrice && lowestPrice > 0 ? lowestPrice : currentPrice;
  const expectedSavings = currentPrice > expectedDropPrice ? currentPrice - expectedDropPrice : 0;

  return {
    currentPrice,
    originalPrice,
    previousPrice: hasRealPreviousPrice ? previousPrice : null,
    lowestPrice,
    highestPrice,
    averagePrice,
    totalPricePoints: recordedPrices.length,
    realPriceDrop,
    realPriceDropPct,
    hasRealPriceDrop,
    mrpDiscountAmount,
    mrpDiscountPct,
    priceDropPct: hasRealPriceDrop ? realPriceDropPct : mrpDiscountPct,
    pricePositionPct,
    verdict,
    verdictTitle,
    verdictReason,
    badgeText,
    isAllTimeLow,
    isRealPriceDrop: hasRealPriceDrop && realPriceDropPct >= 5,
    isFakeMrpDiscount,
    isBelowAverage,
    isAboveAverage,
    dropProbabilityPct,
    dropProbabilityLabel,
    dropAdvice,
    dealAction,
    dealScore,
    expectedDropPrice,
    expectedSavings,
  };
}
