/**
 * Computes historical price statistics and buying recommendations for a product.
 * Used across the API and tracking engine to give users mathematical clarity on deals.
 *
 * @param {Object} product - Product document with price, originalPrice, previousPrice, priceHistory
 * @returns {Object} priceStats
 */
export function computePriceStats(product) {
  if (!product) return null;

  const currentPrice = Number(product.price) || 0;
  const originalPrice = Number(product.originalPrice) || 0;
  const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];

  // Collect all recorded prices in history
  const recordedPrices = history
    .map((h) => Number(h.price))
    .filter((p) => typeof p === 'number' && !isNaN(p) && p > 0);

  if (currentPrice > 0) {
    recordedPrices.push(currentPrice);
  }

  // Fallback if no prices recorded
  if (recordedPrices.length === 0) {
    return {
      currentPrice,
      originalPrice,
      lowestPrice: currentPrice || originalPrice,
      highestPrice: originalPrice || currentPrice,
      averagePrice: currentPrice || originalPrice,
      totalPricePoints: 0,
      priceDropPct: originalPrice && currentPrice < originalPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0,
      pricePositionPct: 50,
      verdict: 'FAIR_PRICE',
      verdictTitle: 'Fair Price',
      verdictReason: 'Not enough historical price tracking points recorded yet.',
      isAllTimeLow: false,
    };
  }

  const lowestPrice = Math.min(...recordedPrices);
  const highestPrice = Math.max(...recordedPrices);
  const sum = recordedPrices.reduce((acc, p) => acc + p, 0);
  const averagePrice = Math.round(sum / recordedPrices.length);

  // Percentile position: 0% = at lowest price, 100% = at highest price
  let pricePositionPct = 50;
  if (highestPrice > lowestPrice) {
    pricePositionPct = Math.min(100, Math.max(0, Math.round(((currentPrice - lowestPrice) / (highestPrice - lowestPrice)) * 100)));
  }

  // Calculate discount against original/highest price
  const baseMrp = originalPrice > currentPrice ? originalPrice : highestPrice;
  const priceDropPct = baseMrp > currentPrice ? Math.round(((baseMrp - currentPrice) / baseMrp) * 100) : 0;

  // Determine buying verdict
  let verdict = 'FAIR_PRICE';
  let verdictTitle = 'Fair Price';
  let verdictReason = 'Current price is close to the average tracked price.';
  let isAllTimeLow = false;

  const isAtLowest = currentPrice <= lowestPrice || currentPrice <= lowestPrice * 1.02; // within 2% of lowest
  const isBelowAverage = (averagePrice > 0 && currentPrice <= averagePrice * 0.94) || (originalPrice > 0 && currentPrice <= originalPrice * 0.70); // >= 6% below avg or >= 30% off MRP
  const isAboveAverage = averagePrice > 0 && currentPrice >= averagePrice * 1.08; // >= 8% above average

  if (isAtLowest && recordedPrices.length >= 2) {
    verdict = 'BUY_NOW';
    verdictTitle = '🔥 All-Time Low! Buy Now';
    verdictReason = `Price is at its lowest recorded level (₹${currentPrice.toLocaleString('en-IN')}). Great time to buy!`;
    isAllTimeLow = true;
  } else if (isBelowAverage) {
    verdict = 'GOOD_PRICE';
    verdictTitle = '✅ Great Deal';
    verdictReason = `Current price is ₹${(averagePrice - currentPrice).toLocaleString('en-IN')} below the historical average.`;
  } else if (isAboveAverage) {
    verdict = 'WAIT';
    verdictTitle = '⏳ Wait for Drop';
    verdictReason = `Price is ₹${(currentPrice - averagePrice).toLocaleString('en-IN')} higher than historical average. It may drop soon.`;
  } else {
    verdict = 'FAIR_PRICE';
    verdictTitle = '⚖️ Fair Price';
    verdictReason = 'Current price is within the normal historical fluctuation range.';
  }

  return {
    currentPrice,
    originalPrice,
    lowestPrice,
    highestPrice,
    averagePrice,
    totalPricePoints: recordedPrices.length,
    priceDropPct,
    pricePositionPct,
    verdict,
    verdictTitle,
    verdictReason,
    isAllTimeLow,
  };
}
