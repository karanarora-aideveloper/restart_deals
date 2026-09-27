/**
 * Utility for building affiliate URLs and website backlinks for published deals.
 */

const AMAZON_IN_TAG = process.env.AMAZON_IN_AFFILIATE_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.AMAZON_US_AFFILIATE_TAG || '';
const FLIPKART_AFFID = process.env.FLIPKART_AFFILIATE_TAG || '';
const CUELINKS_PUB_ID = process.env.CUELINKS_PUB_ID || '';
const WEBSITE_BASE_URL = (process.env.WEBSITE_BASE_URL || 'https://www.shoppersdeals.in').replace(/\/+$/, '');

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

    // 3. Flipkart / Shopsy Direct Tag
    if (hostname.includes('flipkart.com') || hostname.includes('shopsy.in')) {
      if (FLIPKART_AFFID) {
        parsed.searchParams.set('affid', FLIPKART_AFFID);
        return parsed.toString();
      }
    }

    // 4. Cuelinks Wrapper for Indian Merchants (Flipkart, Myntra, Ajio, Meesho, Nykaa, etc.)
    if (CUELINKS_PUB_ID && upperCountry === 'IN') {
      const cuelinksMerchants = ['flipkart', 'shopsy', 'myntra', 'ajio', 'meesho', 'nykaa', 'croma', 'tatacliq'];
      const isEligible = cuelinksMerchants.some(m => hostname.includes(m) || merchant === m);
      if (isEligible) {
        return `https://linksredirect.com/?pub_id=${encodeURIComponent(CUELINKS_PUB_ID)}&url=${encodeURIComponent(urlStr)}`;
      }
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
