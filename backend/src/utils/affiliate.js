/**
 * Utility for building affiliate URLs and website backlinks for published deals.
 */

const AMAZON_IN_TAG = process.env.AMAZON_IN_AFFILIATE_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.AMAZON_US_AFFILIATE_TAG || '';
const FLIPKART_AFFID = process.env.FLIPKART_AFFILIATE_TAG || '';
const CUELINKS_PUB_ID = process.env.CUELINKS_PUB_ID || '325472';
const CUELINKS_API_KEY = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || '';
const WEBSITE_BASE_URL = (process.env.WEBSITE_BASE_URL || 'https://www.shoppersdeals.in').replace(/\/+$/, '');

const memoryUrlCache = new Map();

/**
 * Appends or injects the appropriate merchant affiliate tracking parameters.
 *
 * @param {string} urlStr - Clean canonical product URL
 * @param {string} country - Country code ('IN', 'US', etc.)
 * @param {string} merchant - Merchant identifier ('amazon', 'flipkart', etc.)
 * @returns {string} Fully monetized affiliate URL
 */
export function buildAffiliateUrl(urlStr, country = 'IN', merchant = 'generic') {
  if (!urlStr) return '';

  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    const upperCountry = (country || 'IN').toUpperCase();

    // 1. Amazon India
    if (hostname.includes('amazon.in') || (hostname.includes('amazon.') && upperCountry === 'IN')) {
      if (AMAZON_IN_TAG) {
        parsed.searchParams.set('tag', AMAZON_IN_TAG);
        return parsed.toString();
      }
    }

    // 2. Amazon US / Global
    if (hostname.includes('amazon.com') || (hostname.includes('amazon.') && upperCountry === 'US')) {
      if (AMAZON_US_TAG) {
        parsed.searchParams.set('tag', AMAZON_US_TAG);
        return parsed.toString();
      }
    }

    // 3. Already converted Cuelinks redirect
    if (hostname.includes('linksredirect.com') || hostname.includes('clnk.in')) {
      return parsed.toString();
    }

    // 4. Flipkart / Shopsy Direct Tag (if specifically configured)
    if ((hostname.includes('flipkart.com') || hostname.includes('shopsy.in')) && FLIPKART_AFFID) {
      parsed.searchParams.set('affid', FLIPKART_AFFID);
      return parsed.toString();
    }

    // 5. Cuelinks Universal Wrapper for all Non-Amazon Indian Merchants (Flipkart, Myntra, Ajio, Meesho, Nykaa, Croma, etc.)
    const cuelinksPubId = process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID;
    if (cuelinksPubId && upperCountry === 'IN' && !hostname.includes('amazon.')) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(cuelinksPubId)}&subid=tg&source=api&url=${encodeURIComponent(urlStr)}`;
    }

    return parsed.toString();
  } catch (err) {
    // Fallback for unparseable strings
    if (urlStr.includes('amazon.in')) {
      const sep = urlStr.includes('?') ? '&' : '?';
      return `${urlStr}${sep}tag=${AMAZON_IN_TAG}`;
    }
    return urlStr;
  }
}

/**
 * Returns the deep-link to the deal/product page on ShoppersDeals website.
 *
 * @param {object} deal - Deal document
 * @returns {string} Web deal URL
 */
export function getWebsiteDealUrl(deal) {
  if (!deal || !deal._id) return WEBSITE_BASE_URL;
  return `${WEBSITE_BASE_URL}/deal/${deal._id}`;
}

export function formatPriceCurrency(amount, country = 'IN') {
  if (amount == null || isNaN(amount)) return null;
  const upperCountry = (country || 'IN').toUpperCase();

  if (upperCountry === 'US') {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  // Default to INR
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
}

/**
 * Async version of buildAffiliateUrl with Cuelinks API v3 link conversion support.
 */
export async function buildAffiliateUrlAsync(urlStr, country = 'IN', merchant = 'generic', subId = 'tg') {
  if (!urlStr) return '';
  const apiKey = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY;
  const upperCountry = (country || 'IN').toUpperCase();

  // If Amazon, use standard direct Amazon Associates tag
  if (urlStr.includes('amazon.')) {
    return buildAffiliateUrl(urlStr, country, merchant);
  }

  // If Indian merchant and Cuelinks API key is available, use API v3 conversion
  if (apiKey && upperCountry === 'IN') {
    try {
      const cacheKey = `${urlStr}:${subId}`;
      if (memoryUrlCache.has(cacheKey)) return memoryUrlCache.get(cacheKey);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('https://developers.cuelinks.com/pub_api/v3/links/convert', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ url: urlStr, subid: subId, shorten: false, channel_id: Number(process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID) }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const affUrl = data?.affiliate_url || data?.url || data?.data?.affiliate_url;
        if (affUrl) {
          memoryUrlCache.set(cacheKey, affUrl);
          return affUrl;
        }
      }
    } catch (e) {
      // Fallback to sync builder
    }
  }

  return buildAffiliateUrl(urlStr, country, merchant);
}
