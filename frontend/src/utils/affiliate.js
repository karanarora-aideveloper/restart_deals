/**
 * Universal Outbound Affiliate & Deep-Linking Utility for ShoppersDeals
 *
 * Handles:
 * 1. Amazon India (amazon.in) -> tag=shoppersdea03-21
 * 2. Amazon US (amazon.com)   -> tag=shoppersdeals-20 (or US associates tag)
 * 3. Flipkart (flipkart.com, shopsy.in) -> affid=...
 * 4. Indian Multi-Store (Myntra, Nykaa, Ajio, Meesho, Croma) -> Cuelinks Monetization
 */

const AMAZON_IN_TAG = process.env.EXPO_PUBLIC_AMAZON_IN_AFFILIATE_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.EXPO_PUBLIC_AMAZON_US_AFFILIATE_TAG || 'shoppersdeals-20';
const FLIPKART_AFFID = process.env.EXPO_PUBLIC_FLIPKART_AFFILIATE_TAG || 'shoppersdeals';
const CUELINKS_PUB_ID = process.env.EXPO_PUBLIC_CUELINKS_PUB_ID || '197022'; // ShoppersDeals Cuelinks publisher id

export function buildAffiliateUrl(urlStr, merchantHint = null) {
  if (!urlStr) return '';

  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // 1. Amazon India (amazon.in)
    if (hostname.endsWith('amazon.in') || hostname.includes('amazon.in')) {
      if (AMAZON_IN_TAG) {
        parsed.searchParams.set('tag', AMAZON_IN_TAG);
        return parsed.toString();
      }
    }

    // 2. Amazon US (amazon.com)
    if (hostname.endsWith('amazon.com') || hostname === 'amazon.com') {
      if (AMAZON_US_TAG) {
        parsed.searchParams.set('tag', AMAZON_US_TAG);
        return parsed.toString();
      }
    }

    // 3. Flipkart & Shopsy
    if (hostname.includes('flipkart.com') || hostname.includes('shopsy.in')) {
      if (FLIPKART_AFFID) {
        parsed.searchParams.set('affid', FLIPKART_AFFID);
        return parsed.toString();
      }
    }

    // 4. Cuelinks wrapper for other Indian stores (Myntra, Nykaa, Ajio, Meesho, Croma, TataCliq)
    const cuelinksStores = ['myntra.com', 'nykaa.com', 'ajio.com', 'meesho.com', 'croma.com', 'tatacliq.com'];
    const isCuelinksStore = cuelinksStores.some((store) => hostname.includes(store)) ||
      (merchantHint && ['myntra', 'nykaa', 'ajio', 'meesho', 'croma'].includes(merchantHint.toLowerCase()));

    if (CUELINKS_PUB_ID && isCuelinksStore) {
      return `https://linksredirect.com/?pub_id=${encodeURIComponent(CUELINKS_PUB_ID)}&url=${encodeURIComponent(urlStr)}`;
    }

    return parsed.toString();
  } catch (err) {
    // Fallback if URL constructor fails
    if (urlStr.includes('amazon.in')) {
      return urlStr.includes('?') ? `${urlStr}&tag=${AMAZON_IN_TAG}` : `${urlStr}?tag=${AMAZON_IN_TAG}`;
    }
    return urlStr;
  }
}
