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
