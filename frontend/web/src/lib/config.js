const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

export const API_BASE_URL = (
  isProd
    ? (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_API_URL
        : 'https://api.shoppersdeals.in')
    : (process.env.NEXT_PUBLIC_API_URL || 'https://api.shoppersdeals.in')
).replace(/\/$/, '');

export const SITE_URL = (
  isProd
    ? (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_SITE_URL
        : 'https://www.shoppersdeals.in')
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.shoppersdeals.in')
).replace(/\/$/, '');

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
