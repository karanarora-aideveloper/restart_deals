/**
 * Universal Outbound Affiliate & Deep-Linking Utility for API Service.
 */

const AMAZON_IN_TAG = process.env.AMAZON_IN_AFFILIATE_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.AMAZON_US_AFFILIATE_TAG || 'shoppersdeals-20';
const FLIPKART_AFFID = process.env.FLIPKART_AFFILIATE_TAG || '';
const CUELINKS_PUB_ID = process.env.CUELINKS_PUB_ID || '325472';
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

    // 3. Already converted Cuelinks redirect
    if (hostname.includes('linksredirect.com') || hostname.includes('clnk.in')) {
      return parsed.toString();
    }

    // 4. Flipkart / Shopsy Direct Tag (if specifically configured)
    if ((hostname.includes('flipkart.com') || hostname.includes('shopsy.in')) && FLIPKART_AFFID) {
      parsed.searchParams.set('affid', FLIPKART_AFFID);
      return parsed.toString();
    }

    // 5. Cuelinks Universal Wrapper for all Non-Amazon Indian Merchants (Flipkart, Myntra, Ajio, Meesho, Nykaa, Croma, D2C, etc.)
    const pubId = process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID;
    if (pubId && upperCountry === 'IN' && !hostname.includes('amazon.')) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(pubId)}&subid=api_alert&source=api&url=${encodeURIComponent(urlStr)}`;
    }

    return parsed.toString();
  } catch (err) {
    if (urlStr.includes('amazon.in')) {
      const sep = urlStr.includes('?') ? '&' : '?';
      return `${urlStr}${sep}tag=${AMAZON_IN_TAG}`;
    }
    return urlStr;
  }
}

export function formatPriceCurrency(amount, country = 'IN') {
  if (amount == null || isNaN(amount)) return '';
  const upperCountry = (country || 'IN').toUpperCase();
  if (upperCountry === 'US') {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
}
