const AMAZON_IN_TAG = process.env.NEXT_PUBLIC_AMAZON_IN_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.NEXT_PUBLIC_AMAZON_US_TAG || 'shoppersdeals-20';
const FLIPKART_AFFID = process.env.NEXT_PUBLIC_FLIPKART_AFFILIATE_TAG || '';
const CUELINKS_PUB_ID = process.env.NEXT_PUBLIC_CUELINKS_PUB_ID || '325472';

/**
 * Universal Outbound Affiliate & Deep-Linking Utility for ShoppersDeals Web
 */
export function getAffiliateUrl(urlStr, country = null) {
  if (!urlStr) return '';
  const lower = urlStr.toLowerCase();

  try {
    const urlObj = new URL(urlStr);
    const hostname = urlObj.hostname.toLowerCase();

    // 1. Amazon India
    if (hostname.endsWith('amazon.in') || hostname.includes('amazon.in')) {
      urlObj.searchParams.set('tag', AMAZON_IN_TAG);
      return urlObj.toString();
    }

    // 2. Amazon US
    if (hostname.endsWith('amazon.com') || hostname === 'amazon.com') {
      const isUs = (country && String(country).toUpperCase() === 'US') || !hostname.includes('amazon.in');
      urlObj.searchParams.set('tag', isUs ? AMAZON_US_TAG : AMAZON_IN_TAG);
      return urlObj.toString();
    }

    // 3. Already monetized or Cuelinks redirect
    if (hostname.includes('linksredirect.com') || hostname.includes('clnk.in')) {
      return urlStr;
    }

    // 4. Flipkart / Shopsy (Direct tag if configured, otherwise falls through to Cuelinks)
    if ((hostname.includes('flipkart.com') || hostname.includes('shopsy.in')) && FLIPKART_AFFID) {
      urlObj.searchParams.set('affid', FLIPKART_AFFID);
      return urlObj.toString();
    }

    // 5. Cuelinks v3 Universal Monetization for ALL Non-Amazon Merchants (Flipkart, Myntra, Nykaa, Ajio, Meesho, Croma, TataCliq, Boat, Vijay Sales, etc.)
    // Uses verified Channel ID 325472. Cuelinks Link Kit tracks commission for 10,000+ participating merchants,
    // and seamlessly passes through for non-monetized sites without breaking the user experience.
    const isIndia = !country || String(country).toUpperCase() === 'IN';
    if (CUELINKS_PUB_ID && isIndia && !hostname.includes('amazon.')) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(CUELINKS_PUB_ID)}&subid=web&source=api&url=${encodeURIComponent(urlStr)}`;
    }

    return urlObj.toString();
  } catch (e) {
    if (lower.includes('amazon.in')) {
      return urlStr.includes('?') ? `${urlStr}&tag=${AMAZON_IN_TAG}` : `${urlStr}?tag=${AMAZON_IN_TAG}`;
    }
    if (lower.includes('amazon.com')) {
      return urlStr.includes('?') ? `${urlStr}&tag=${AMAZON_US_TAG}` : `${urlStr}?tag=${AMAZON_US_TAG}`;
    }
    if (CUELINKS_PUB_ID && !lower.includes('amazon.') && !lower.includes('linksredirect.com')) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(CUELINKS_PUB_ID)}&subid=web&source=api&url=${encodeURIComponent(urlStr)}`;
    }
    return urlStr;
  }
}

export function getMerchantInfo(urlOrMerchant) {
  const s = (urlOrMerchant || '').toLowerCase();
  const isAmazon = s.includes('amazon') || s.includes('amzn');
  const isShopsy = s.includes('shopsy');
  const isFlipkart = !isShopsy && (s.includes('flipkart') || s.includes('fkrt') || s.includes('fktr') || s.includes('affiliates.app.link'));
  const isMyntra = s.includes('myntra');
  const isMeesho = s.includes('meesho');
  const isAjio = s.includes('ajio');
  const isNykaa = s.includes('nykaa');
  const isCroma = s.includes('croma');

  if (isAmazon) return { id: 'amazon', label: 'Amazon', emoji: '🛒', logo: '/amazon.webp', btnColor: '#FF9900', textColor: '#0f172a' };
  if (isShopsy) return { id: 'shopsy', label: 'Shopsy', emoji: '🛍️', logo: '/shopsy.webp', btnColor: '#9333ea', textColor: '#ffffff' };
  if (isFlipkart) return { id: 'flipkart', label: 'Flipkart', emoji: '🛍️', logo: '/flipkart.webp', btnColor: '#2874F0', textColor: '#ffffff' };
  if (isMyntra) return { id: 'myntra', label: 'Myntra', emoji: '👗', logo: '/myntra.webp', btnColor: '#e11d48', textColor: '#ffffff' };
  if (isMeesho) return { id: 'meesho', label: 'Meesho', emoji: '🎁', logo: '/meesho.webp', btnColor: '#7c3aed', textColor: '#ffffff' };
  if (isAjio) return { id: 'ajio', label: 'Ajio', emoji: '🕶️', logo: null, btnColor: '#16a34a', textColor: '#ffffff' };
  if (isNykaa) return { id: 'nykaa', label: 'Nykaa', emoji: '💄', logo: null, btnColor: '#db2777', textColor: '#ffffff' };
  if (isCroma) return { id: 'croma', label: 'Croma', emoji: '⚡', logo: null, btnColor: '#0284c7', textColor: '#ffffff' };
  return { id: 'other', label: 'Deal', emoji: '🏷️', logo: null, btnColor: '#FF6B00', textColor: '#ffffff' };
}

export function formatRelativeTime(createdAt) {
  if (!createdAt) return 'Just now';
  const now = Date.now();
  const date = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  // Explicit locale + timeZone: without these, this client component renders once on the
  // server (whatever TZ that machine is in) and again during browser hydration (the visitor's
  // TZ) — a mismatch here is a guaranteed React hydration error, not a rare edge case. Pinning
  // both to Asia/Kolkata (an India-only product) keeps server and client output identical.
  return new Date(createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function formatInr(n, country = null) {
  if (n === null || n === undefined) return null;
  const upper = typeof country === 'string' ? country.toUpperCase() : '';
  if (upper === 'US') {
    return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
}

export const formatPrice = formatInr;

// Some deal/product records have `imageUrl` baked in as `http://localhost:<port>/...` — a
// backend fallback (Telegram photo download) that defaults its public base URL to localhost
// when PUBLIC_BASE_URL isn't set in that service's environment. Unreachable for any real
// visitor. The <img onError> fallback already recovers visually, but this skips the guaranteed-
// to-fail request outright and goes straight to the placeholder — cheaper and no console noise.
// Fix belongs in backend/src/config.js's `publicBaseUrl` (set PUBLIC_BASE_URL where that
// service runs) — out of this app's reach to deploy.
export function isUsableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//i.test(url)) return false;
  // Amazon legacy media server returns HTTP 200 with a 43-byte transparent 1x1 blank GIF
  if (url.includes('images-na.ssl-images-amazon.com/images/P/')) return false;
  if (url.endsWith('/images/placeholder.png')) return false;
  return true;
}
