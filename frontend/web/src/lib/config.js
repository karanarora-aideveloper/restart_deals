const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function sanitizeHttpUrl(url, fallback) {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url.replace(/\/$/, '');
  }
  return fallback.replace(/\/$/, '');
}

export const API_BASE_URL = isProd
  ? (sanitizeHttpUrl(process.env.NEXT_PUBLIC_API_URL, 'https://api.shoppersdeals.in').includes('localhost')
      ? 'https://api.shoppersdeals.in'
      : sanitizeHttpUrl(process.env.NEXT_PUBLIC_API_URL, 'https://api.shoppersdeals.in'))
  : sanitizeHttpUrl(process.env.NEXT_PUBLIC_API_URL, 'https://api.shoppersdeals.in');

export const SITE_URL = isProd
  ? (sanitizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL, 'https://www.shoppersdeals.in').includes('localhost')
      ? 'https://www.shoppersdeals.in'
      : sanitizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL, 'https://www.shoppersdeals.in'))
  : sanitizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL, 'https://www.shoppersdeals.in');

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_wLA9gRd7oxsendn9i2z7CppaytbHaokeZTUwGPPEi4eJ';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
export const POSTHOG_PROJECT_ID = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID || '364108';

/**
 * Extract hostname from a request, headers object, or host string
 */
function extractHost(hostOrReq) {
  if (!hostOrReq) return '';
  if (typeof hostOrReq === 'string') return hostOrReq.toLowerCase();
  if (typeof hostOrReq.get === 'function') {
    return (hostOrReq.get('x-site-host') || hostOrReq.get('x-forwarded-host') || hostOrReq.get('host') || '').toLowerCase();
  }
  if (hostOrReq.headers) {
    if (typeof hostOrReq.headers.get === 'function') {
      return (hostOrReq.headers.get('x-site-host') || hostOrReq.headers.get('x-forwarded-host') || hostOrReq.headers.get('host') || '').toLowerCase();
    }
    return (hostOrReq.headers['x-site-host'] || hostOrReq.headers['x-forwarded-host'] || hostOrReq.headers.host || '').toLowerCase();
  }
  return '';
}

/**
 * Returns the canonical base URL for the active domain (dealpanda.app vs shoppersdeals.in)
 */
export function getBaseUrl(hostOrReq) {
  const host = extractHost(hostOrReq);
  if (host.includes('dealpanda') || host.includes('dealspanda')) {
    return 'https://dealpanda.app';
  }
  return SITE_URL;
}

/**
 * Returns dynamic branding, titles, and metadata templates per domain
 */
export function getSiteBranding(hostOrReq) {
  const host = extractHost(hostOrReq);
  const isDealPanda = host.includes('dealpanda') || host.includes('dealspanda');

  if (isDealPanda) {
    return {
      isDealPanda: true,
      brandName: 'DealPanda',
      siteUrl: 'https://dealpanda.app',
      logoUrl: '/dealpanda-logo.png',
      bannerUrl: '/dealpanda-banner.png',
      titleTemplate: '%s | DealPanda',
      defaultTitle: 'DealPanda: Price Tracker, Daily Deals & Shopping Coupons',
      tagline: 'Track price drops, lightning loot deals & discounts across Amazon, Flipkart & Myntra.',
      description: 'Discover live price drops, deals and discounts. Never pay full price again with DealPanda price tracker.',
      brandPrefix: 'Deal',
      brandSuffix: 'Panda',
      shortName: 'DP',
      footerSummary: 'DealPanda is a premier deal tracking and price drop monitoring platform. We monitor Amazon, Flipkart, and top stores 24/7 to bring you verified price drops, lightning loot deals, and coupons.',
      copyrightOwner: 'DealPanda',
    };
  }

  return {
    isDealPanda: false,
    brandName: 'ShoppersDeals',
    siteUrl: SITE_URL,
    logoUrl: '/logo.png',
    bannerUrl: '/logo.png',
    titleTemplate: '%s | ShoppersDeals',
    defaultTitle: 'ShoppersDeals: Best Live Deals, Price History & Coupons',
    tagline: 'Best Live Deals & Shopping Coupons',
    description: 'Find the hottest live deals and discounts from Amazon, Flipkart, and Myntra. Save big on electronics, fashion, and everyday essentials.',
    brandPrefix: 'Shoppers',
    brandSuffix: 'Deals',
    shortName: 'SD',
    footerSummary: "ShoppersDeals is India's premier live deal tracking platform. We monitor Amazon, Flipkart, Myntra, and top stores 24/7 to bring you verified price drops, lightning loot deals, and coupons.",
    copyrightOwner: 'ShoppersDeals',
  };
}
