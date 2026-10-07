import fetch from 'node-fetch';
import { createSearchQuery, normalizeBuyhatkeIntervals } from '../scripts/backfill_history_pipeline.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Fetches historical price checkpoints from Buyhatke for a given product.
 * Searches by title / ASIN and extracts normalized daily price checkpoints.
 * 
 * @param {string} asin Product ASIN or identifier
 * @param {string} title Product title
 * @param {string} [merchant='amazon'] Store name
 * @param {number} [currentPrice] Current live price
 * @param {number} [originalPrice] Current MRP
 * @returns {Promise<Array<{ date: string, price: number, originalPrice: number, timestamp: Date }> | null>}
 */
export async function fetchBuyhatkePriceHistory(asin, title, merchant = 'amazon', currentPrice = 0, originalPrice = 0) {
  try {
    const cleanMerchant = (merchant || 'amazon').toLowerCase().trim();
    const query = createSearchQuery(title) || asin;
    if (!query) return null;

    const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;
    const sRes = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    if (!sRes.ok) return null;
    const sHtml = await sRes.text();

    const regex = /href=["'](\/(?:amazon|flipkart|myntra|ajio|tatacliq|nykaa|croma|meesho)-[^"']*price-in-india-[^"']*)["']/g;
    let m;
    const candidates = [];
    const seen = new Set();

    while ((m = regex.exec(sHtml)) !== null) {
      const rawHref = m[1];
      if (seen.has(rawHref)) continue;
      seen.add(rawHref);

      const slugText = rawHref
        .replace(/^\/(?:amazon|flipkart|myntra|ajio|tatacliq|nykaa|croma|meesho)-/, '')
        .replace(/-price-in-india-.*$/, '')
        .replace(/-/g, ' ')
        .trim();

      const pidMatch = asin && rawHref.toUpperCase().includes(asin.toUpperCase());
      const merchantMatch = rawHref.toLowerCase().includes(`/${cleanMerchant}-`);

      candidates.push({
        url: 'https://buyhatke.com' + rawHref,
        slugText,
        pidMatch,
        merchantMatch
      });
    }

    if (candidates.length === 0) return null;

    // Prioritize direct ASIN match and matching merchant
    candidates.sort((a, b) => {
      if (a.pidMatch && !b.pidMatch) return -1;
      if (!a.pidMatch && b.pidMatch) return 1;
      if (a.merchantMatch && !b.merchantMatch) return -1;
      if (!a.merchantMatch && b.merchantMatch) return 1;
      return 0;
    });

    for (const cand of candidates.slice(0, 4)) {
      try {
        const pRes = await fetch(cand.url, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000
        });
        if (!pRes.ok) continue;
        const html = await pRes.text();

        const histStart = html.indexOf('history:[');
        if (histStart === -1) continue;

        const arrayStart = histStart + 8;
        let depth = 0;
        let arrayEnd = -1;
        for (let i = arrayStart; i < html.length; i++) {
          if (html[i] === '[') depth++;
          else if (html[i] === ']') {
            depth--;
            if (depth === 0) {
              arrayEnd = i;
              break;
            }
          }
        }

        if (arrayEnd !== -1) {
          const rawArrStr = html.slice(arrayStart, arrayEnd + 1);
          // Parse JS array literal safely
          const rawIntervals = Function(`"use strict"; return (${rawArrStr});`)();
          if (Array.isArray(rawIntervals) && rawIntervals.length > 0) {
            // Price sanity check: make sure latest candidate price is within 0.25x to 4.0x of current price
            if (currentPrice > 0) {
              const latestRawPrice = Number(rawIntervals[rawIntervals.length - 1].price);
              if (
                latestRawPrice > 0 &&
                (latestRawPrice < currentPrice * 0.25 || latestRawPrice > currentPrice * 4.0)
              ) {
                continue;
              }
            }

            const checkpoints = normalizeBuyhatkeIntervals(rawIntervals, currentPrice, originalPrice);
            if (checkpoints && checkpoints.length >= 30) {
              return checkpoints;
            }
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
  } catch (err) {
    console.warn(`[Buyhatke Service] Error fetching price history for ${asin}:`, err.message);
  }

  return null;
}

export default {
  fetchBuyhatkePriceHistory
};
