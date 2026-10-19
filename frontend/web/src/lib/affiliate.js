const AMAZON_IN_TAG = process.env.NEXT_PUBLIC_AMAZON_IN_TAG || 'shoppersdea03-21';
const AMAZON_US_TAG = process.env.NEXT_PUBLIC_AMAZON_US_TAG || 'shoppersdeals-20';
const FLIPKART_AFFID = process.env.NEXT_PUBLIC_FLIPKART_AFFILIATE_TAG || '';
const CUELINKS_PUB_ID = process.env.NEXT_PUBLIC_CUELINKS_PUB_ID || '325472';

/**
 * Universal Outbound Affiliate & Deep-Linking Utility for ShoppersDeals Web
 */
export function getAffiliateUrl(urlInput, country = null) {
  const urlStr = typeof urlInput === 'string' ? urlInput : urlInput?.dealUrl || urlInput?.url || '';
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
  const isPlum = s.includes('plum');
  const isMamaearth = s.includes('mamaearth');
  const isDermaCo = s.includes('dermaco') || s.includes('derma co');
  const isMCaffeine = s.includes('mcaffeine');
  const isDotAndKey = s.includes('dotandkey') || s.includes('dot & key');
  const isDrSheths = s.includes('drsheths') || s.includes('dr sheth');
  const isSugar = s.includes('sugar');
  const isMinimalist = s.includes('minimalist');
  const isBoat = s.includes('boat');
  const isNoise = s.includes('noise');
  const isBoult = s.includes('boult');
  const isPortronics = s.includes('portronics');
  const isSnitch = s.includes('snitch');
  const isXyxx = s.includes('xyxx');
  const isBombayShaving = s.includes('bombayshaving') || s.includes('bombay shaving') || s.includes('bombay');
  const isBlinkit = s.includes('blinkit') || s.includes('grofers');
  const isInstamart = s.includes('instamart') || s.includes('swiggy');
  const isZepto = s.includes('zepto');

  if (isAmazon) return { id: 'amazon', name: 'Amazon', label: 'Amazon', emoji: '🛒', logo: '/amazon.webp', btnColor: '#FF9900', textColor: '#0f172a' };
  if (isShopsy) return { id: 'shopsy', name: 'Shopsy', label: 'Shopsy', emoji: '🛍️', logo: '/shopsy.webp', btnColor: '#9333ea', textColor: '#ffffff' };
  if (isFlipkart) return { id: 'flipkart', name: 'Flipkart', label: 'Flipkart', emoji: '🛍️', logo: '/flipkart.webp', btnColor: '#2874F0', textColor: '#ffffff' };
  if (isMyntra) return { id: 'myntra', name: 'Myntra', label: 'Myntra', emoji: '👗', logo: '/myntra.webp', btnColor: '#e11d48', textColor: '#ffffff' };
  if (isMeesho) return { id: 'meesho', name: 'Meesho', label: 'Meesho', emoji: '🎁', logo: '/meesho.webp', btnColor: '#7c3aed', textColor: '#ffffff' };
  if (isAjio) return { id: 'ajio', name: 'Ajio', label: 'Ajio', emoji: '🕶️', logo: '/ajio.webp', btnColor: '#16a34a', textColor: '#ffffff' };
  if (isNykaa) return { id: 'nykaa', name: 'Nykaa', label: 'Nykaa', emoji: '💄', logo: '/nykaa.webp', btnColor: '#db2777', textColor: '#ffffff' };
  if (isCroma) return { id: 'croma', name: 'Croma', label: 'Croma', emoji: '⚡', logo: '/croma.webp', btnColor: '#0284c7', textColor: '#ffffff' };
  if (isBombayShaving) return { id: 'bombayshaving', name: 'Bombay Shaving Company', label: 'Bombay Shaving', emoji: '🪒', logo: '/bombayshaving-dark.webp', btnColor: '#1e3a5f', textColor: '#ffffff' };
  if (isPlum) return { id: 'plum', name: 'Plum Goodness', label: 'Plum', emoji: '🌿', logo: null, btnColor: '#4f46e5', textColor: '#ffffff' };
  if (isMamaearth) return { id: 'mamaearth', name: 'Mamaearth', label: 'Mamaearth', emoji: '🌱', logo: null, btnColor: '#059669', textColor: '#ffffff' };
  if (isDermaCo) return { id: 'thedermaco', name: 'The Derma Co', label: 'The Derma Co', emoji: '🔬', logo: null, btnColor: '#0284c7', textColor: '#ffffff' };
  if (isMCaffeine) return { id: 'mcaffeine', name: 'mCaffeine', label: 'mCaffeine', emoji: '☕', logo: null, btnColor: '#78350f', textColor: '#ffffff' };
  if (isDotAndKey) return { id: 'dotandkey', name: 'Dot & Key', label: 'Dot & Key', emoji: '✨', logo: null, btnColor: '#d946ef', textColor: '#ffffff' };
  if (isDrSheths) return { id: 'drsheths', name: "Dr. Sheth's", label: "Dr. Sheth's", emoji: '🧴', logo: null, btnColor: '#0891b2', textColor: '#ffffff' };
  if (isSugar) return { id: 'sugar', name: 'SUGAR Cosmetics', label: 'SUGAR', emoji: '💄', logo: null, btnColor: '#e11d48', textColor: '#ffffff' };
  if (isMinimalist) return { id: 'minimalist', name: 'Minimalist', label: 'Minimalist', emoji: '🧪', logo: null, btnColor: '#1e293b', textColor: '#ffffff' };
  if (isBoat) return { id: 'boat', name: 'boAt Lifestyle', label: 'boAt', emoji: '🎧', logo: null, btnColor: '#dc2626', textColor: '#ffffff' };
  if (isNoise) return { id: 'noise', name: 'Noise', label: 'Noise', emoji: '⌚', logo: null, btnColor: '#2563eb', textColor: '#ffffff' };
  if (isBoult) return { id: 'boult', name: 'Boult Audio', label: 'Boult', emoji: '🎵', logo: null, btnColor: '#0d9488', textColor: '#ffffff' };
  if (isPortronics) return { id: 'portronics', name: 'Portronics', label: 'Portronics', emoji: '🔌', logo: null, btnColor: '#d97706', textColor: '#ffffff' };
  if (isSnitch) return { id: 'snitch', name: 'Snitch', label: 'Snitch', emoji: '👔', logo: null, btnColor: '#0f172a', textColor: '#ffffff' };
  if (isXyxx) return { id: 'xyxx', name: 'XYXX Apparels', label: 'XYXX', emoji: '🩳', logo: null, btnColor: '#4338ca', textColor: '#ffffff' };
  if (isBlinkit) return { id: 'blinkit', name: 'Blinkit', label: 'Blinkit', emoji: '⚡', logo: null, btnColor: '#f59e0b', textColor: '#000000' };
  if (isInstamart) return { id: 'instamart', name: 'Swiggy Instamart', label: 'Instamart', emoji: '🍊', logo: null, btnColor: '#ea580c', textColor: '#ffffff' };
  if (isZepto) return { id: 'zepto', name: 'Zepto', label: 'Zepto', emoji: '⚡', logo: null, btnColor: '#7c3aed', textColor: '#ffffff' };
  return { id: 'other', name: 'Deal', label: 'Deal', emoji: '🏷️', logo: null, btnColor: '#FF6B00', textColor: '#ffffff' };
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

export function getCrawlFreshness(dateInput) {
  if (!dateInput) {
    return {
      label: 'Checked recently',
      shortLabel: 'Recently',
      relativeTime: 'recently',
      status: 'fresh',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      dotClass: 'bg-emerald-500 animate-pulse',
      isStale: false,
      tooltip: 'Verified from store recently',
    };
  }

  const now = Date.now();
  const date = new Date(dateInput).getTime();
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relativeTime = 'Just now';
  if (diffMins >= 1 && diffMins < 60) {
    relativeTime = `${diffMins}m ago`;
  } else if (diffHours >= 1 && diffHours < 24) {
    relativeTime = `${diffHours}h ago`;
  } else if (diffDays >= 1) {
    relativeTime = diffDays === 1 ? '1d ago' : `${diffDays}d ago`;
  }

  // < 4 hours: Fresh (Green with pulse)
  if (diffHours < 4) {
    return {
      label: `Checked ${relativeTime}`,
      shortLabel: relativeTime,
      relativeTime,
      status: 'fresh',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      dotClass: 'bg-emerald-500 animate-pulse',
      isStale: false,
      tooltip: `Verified from store ${relativeTime}`,
    };
  }

  // 4 - 12 hours: Moderate (Slate / Neutral)
  if (diffHours < 12) {
    return {
      label: `Checked ${relativeTime}`,
      shortLabel: relativeTime,
      relativeTime,
      status: 'moderate',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/90',
      dotClass: 'bg-slate-400',
      isStale: false,
      tooltip: `Last verified from store ${relativeTime}`,
    };
  }

  // 12 - 24 hours: Aging (Amber warning)
  if (diffHours < 24) {
    return {
      label: `Checked ${relativeTime}`,
      shortLabel: relativeTime,
      relativeTime,
      status: 'aging',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300/90',
      dotClass: 'bg-amber-500',
      isStale: true,
      staleWarning: 'Price may vary',
      tooltip: `Verified from store ${relativeTime} — price may have updated`,
    };
  }

  // > 24 hours: Stale / Likely Expired (Rose / Alert)
  return {
    label: `Checked ${relativeTime}`,
    shortLabel: relativeTime,
    relativeTime,
    status: 'stale',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300/90',
    dotClass: 'bg-rose-500',
    isStale: true,
    staleWarning: 'May be expired',
    tooltip: `Verified from store ${relativeTime} — deal may be expired or price changed`,
  };
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
  if (url.endsWith('/images/placeholder.png') || url.includes('placeholder.png')) return false;
  if (url.includes('/media/telegram/')) return false;
  return true;
}

/**
 * Transforms merchant CDN image URLs to appropriate device resolutions.
 *
 * Size tiers:
 * - 'thumb': Small thumbnail (~200px - 320px) for lists, alerts, miniature previews.
 * - 'card': High-definition card image (~600px - 800px) crisp on 2x/3x Retina screens.
 * - 'hd': Ultra-HD showcase (~1200px - 1500px) for desktop hero PDP views.
 * - 'master': Uncompressed original master image from store CDN.
 *
 * Supported CDNs:
 * 1. Amazon (m.media-amazon.com, images-na.ssl-images-amazon.com, images-eu.ssl-images-amazon.com)
 * 2. Flipkart / Shopsy (rukminim1.flixcart.com, rukminim2.flixcart.com, flixcart.com)
 * 3. Myntra (assets.myntassets.com)
 * 4. Nykaa (images-static.nykaa.com)
 * 5. Ajio (assets.ajio.com)
 */
export function getOptimizedImageUrl(url, size = 'card') {
  if (!url || typeof url !== 'string') return url;

  // 1. Amazon CDN
  // Formats: https://m.media-amazon.com/images/I/71xyzabc._AC_UL320_.jpg
  //          https://m.media-amazon.com/images/I/71xyzabc.jpg
  if (url.includes('media-amazon.com') || url.includes('ssl-images-amazon.com')) {
    if (url.includes('/images/I/')) {
      const master = url.replace(/\._[A-Za-z0-9,._-]+(?=\.[a-zA-Z0-9]+)/, '');
      if (size === 'master') return master;

      const mod = size === 'thumb'
        ? '._AC_UL320_.'
        : size === 'hd'
        ? '._AC_SL1500_.'
        : '._AC_SL800_.';

      return master.replace(/\.([a-zA-Z0-9]+)(\?.*)?$/, (match, ext, query) => {
        return mod + ext + (query || '');
      });
    }
    return url;
  }

  // 2. Flipkart & Shopsy (rukminim.flixcart.com)
  // Formats: https://rukminim2.flixcart.com/image/312/312/xif0q/.../image.jpeg?q=70
  if (url.includes('flixcart.com') || url.includes('rukminim')) {
    if (url.includes('/image/')) {
      let targetDim = '832/832';
      let targetQ = 'q=80';
      if (size === 'thumb') {
        targetDim = '312/312';
        targetQ = 'q=70';
      } else if (size === 'hd' || size === 'master') {
        targetDim = '1664/1664';
        targetQ = 'q=90';
      }
      return url
        .replace(/\/image\/\d+\/\d+\//, `/image/${targetDim}/`)
        .replace(/q=\d+/, targetQ);
    }
    return url;
  }

  // 3. Myntra (assets.myntassets.com)
  // Formats: https://assets.myntassets.com/dpr_1.5,q_60,w_400,c_limit,fl_progressive/assets/images/...
  if (url.includes('assets.myntassets.com')) {
    let targetW = 'w_640,q_75';
    if (size === 'thumb') targetW = 'w_320,q_60';
    else if (size === 'hd' || size === 'master') targetW = 'w_1080,q_85';

    if (/w_\d+/.test(url)) {
      return url.replace(/w_\d+(?:,q_\d+)?/, targetW);
    }
    return url;
  }

  // 4. Nykaa (images-static.nykaa.com)
  // Formats: https://images-static.nykaa.com/media/catalog/product/tr:w-276,h-276,cm-pad_resize/...
  if (url.includes('nykaa.com') && url.includes('tr:')) {
    let targetNykaa = 'tr:w-600,h-600';
    if (size === 'thumb') targetNykaa = 'tr:w-300,h-300';
    else if (size === 'hd' || size === 'master') targetNykaa = 'tr:w-1200,h-1200';

    return url.replace(/tr:w-\d+,h-\d+/, targetNykaa);
  }

  // 5. Ajio (assets.ajio.com)
  // Formats: .../473Wx593H/...
  if (url.includes('assets.ajio.com') && /\d+Wx\d+H/.test(url)) {
    let targetAjio = '768Wx960H';
    if (size === 'thumb') targetAjio = '384Wx480H';
    else if (size === 'hd' || size === 'master') targetAjio = '1024Wx1280H';

    return url.replace(/\d+Wx\d+H/, targetAjio);
  }

  return url;
}

/**
 * Returns a responsive srcSet string for standard HTML <img> or Next.js images.
 */
export function getImageSrcSet(url) {
  if (!url || typeof url !== 'string') return undefined;

  // Amazon
  if ((url.includes('media-amazon.com') || url.includes('ssl-images-amazon.com')) && url.includes('/images/I/')) {
    const thumb = getOptimizedImageUrl(url, 'thumb');
    const card = getOptimizedImageUrl(url, 'card');
    const hd = getOptimizedImageUrl(url, 'hd');
    return `${thumb} 320w, ${card} 800w, ${hd} 1500w`;
  }

  // Flipkart / Shopsy
  if ((url.includes('flixcart.com') || url.includes('rukminim')) && url.includes('/image/')) {
    const thumb = getOptimizedImageUrl(url, 'thumb');
    const card = getOptimizedImageUrl(url, 'card');
    const hd = getOptimizedImageUrl(url, 'hd');
    return `${thumb} 312w, ${card} 832w, ${hd} 1664w`;
  }

  // Myntra
  if (url.includes('assets.myntassets.com') && /w_\d+/.test(url)) {
    const thumb = getOptimizedImageUrl(url, 'thumb');
    const card = getOptimizedImageUrl(url, 'card');
    const hd = getOptimizedImageUrl(url, 'hd');
    return `${thumb} 320w, ${card} 640w, ${hd} 1080w`;
  }

  // Nykaa
  if (url.includes('nykaa.com') && url.includes('tr:')) {
    const thumb = getOptimizedImageUrl(url, 'thumb');
    const card = getOptimizedImageUrl(url, 'card');
    const hd = getOptimizedImageUrl(url, 'hd');
    return `${thumb} 300w, ${card} 600w, ${hd} 1200w`;
  }

  return undefined;
}

/**
 * Deduplicates product images by canonical media ID across stores (Amazon, Flipkart, Myntra, Nykaa).
 * Prevents multiple resolutions or thumbnail variants of the same photo from filling the gallery.
 */
export function getUniqueProductImages(images) {
  if (!Array.isArray(images) || images.length === 0) return [];

  const seen = new Set();
  const unique = [];

  for (const img of images) {
    if (!img || typeof img !== 'string') continue;

    // 1. Amazon: match unique media ID (e.g. 61OUbq2+oaL)
    const amzMatch = img.match(/\/images\/I\/([A-Za-z0-9+_-]+)/);
    if (amzMatch) {
      const key = `amazon:${amzMatch[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Normalize to standard master URL
        unique.push(`https://m.media-amazon.com/images/I/${amzMatch[1]}.jpg`);
      }
      continue;
    }

    // 2. Flipkart / Shopsy: strip resolution dimensions and query params
    if (img.includes('flixcart.com') || img.includes('rukminim')) {
      const cleanFk = img.replace(/\/image\/\d+\/\d+\//, '/').split('?')[0];
      const key = `flipkart:${cleanFk}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(img);
      }
      continue;
    }

    // 3. Myntra: strip width modifiers
    if (img.includes('myntassets.com')) {
      const cleanMy = img.replace(/w_\d+(?:,q_\d+)?/, '').split('?')[0];
      const key = `myntra:${cleanMy}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(img);
      }
      continue;
    }

    // 4. Nykaa: strip transform parameters
    if (img.includes('nykaa.com')) {
      const cleanNy = img.replace(/tr:[^/]+/, '').split('?')[0];
      const key = `nykaa:${cleanNy}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(img);
      }
      continue;
    }

    // Generic fallback
    const key = img.split('?')[0];
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(img);
    }
  }

  return unique;
}


