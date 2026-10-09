import { createSearchQuery, computeContainment, computeTokenSimilarity, normalizeBuyhatkeIntervals } from '../scripts/backfill_history_pipeline.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function safeFetch(url, options = {}) {
  const fetcher = typeof globalThis.fetch === 'function'
    ? globalThis.fetch
    : (await import('node-fetch')).default;
  return fetcher(url, options);
}

function matchNumbers(title, slug) {
  if (!title || !slug) return true;
  const tNums = (title.match(/\b\d{2,}\b/g) || []).filter(n => n.length <= 4);
  if (tNums.length === 0) return true;
  const sNums = new Set((slug.match(/\b\d{2,}\b/g) || []).filter(n => n.length <= 4));
  for (const n of tNums) {
    if (!sNums.has(n)) return false;
  }
  return true;
}

/**
 * Fetches historical price checkpoints from Buyhatke for a given product.
 * Searches with cascading query fallbacks and extracts normalized daily price checkpoints.
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
    const isAccessory = /case|cover|strap|glass|cable|adapter|protector|screen guard|tempered/i.test(title || '');

    // Multi-tier query cascade
    const queries = [];
    const primaryQuery = createSearchQuery(title);
    if (primaryQuery) queries.push(primaryQuery);

    if (title) {
      const simplified = title.split(/[\s,–|-]+/).slice(0, 3).join(' ').trim();
      if (simplified && simplified.length >= 3 && !queries.includes(simplified)) {
        queries.push(simplified);
      }
    }

    if (asin && !queries.includes(asin)) {
      queries.push(asin);
    }

    for (const query of queries) {
      if (!query || query.length < 2) continue;

      const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;
      const sRes = await safeFetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000),
      }).catch(() => null);

      if (!sRes || !sRes.ok) continue;
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

        // If target product is not an accessory, filter out accessory candidates
        if (!isAccessory && /case|cover|strap|glass|screen protector|tempered|pouch|skin/i.test(slugText)) {
          continue;
        }

        // Check model number consistency
        if (!matchNumbers(title, slugText)) {
          continue;
        }

        const pidMatch = Boolean(asin && rawHref.toUpperCase().includes(asin.toUpperCase()));
        const merchantMatch = rawHref.toLowerCase().includes(`/${cleanMerchant}-`);
        const containment = computeContainment(title || query, slugText);
        const similarity = computeTokenSimilarity(title || query, slugText);

        const score =
          (pidMatch ? 3.0 : 0) +
          (merchantMatch ? 1.2 : 0.8) * (containment * 0.7 + similarity * 0.3);

        candidates.push({
          url: 'https://buyhatke.com' + rawHref,
          slugText,
          score,
        });
      }

      if (candidates.length === 0) continue;

      // Sort by best match score descending
      candidates.sort((a, b) => b.score - a.score);

      for (const cand of candidates.slice(0, 8)) {
        try {
          const pRes = await safeFetch(cand.url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(6000),
          }).catch(() => null);

          if (!pRes || !pRes.ok) continue;
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

          if (arrayEnd === -1) continue;

          const rawArrStr = html.slice(arrayStart, arrayEnd + 1);
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
        } catch {
          // Continue to next candidate
        }
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
