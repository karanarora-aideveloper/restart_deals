import crypto from 'crypto';
import { defaultRedis } from '../utils/redis.js';

const CUELINKS_BASE_URL = 'https://developers.cuelinks.com/pub_api/v3';
const CUELINKS_API_KEY = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || '9zEgOgIsz_yQv0efutFtq9OGTh8znPMVUJCz6O67N6o';
const CUELINKS_PUB_ID = process.env.CUELINKS_PUB_ID || '325472';

// 1-hour in-memory cache for converted URLs to prevent duplicate network calls
const memoryUrlCache = new Map();
const MAX_CACHE_SIZE = 5000;

function hashUrl(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Returns whether the Cuelinks v3 API key is configured.
 */
export function isCuelinksConfigured() {
  return Boolean(process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY);
}

/**
 * Generates the deterministic fallback redirect link via Cuelinks Link Kit
 */
export function getFallbackCuelinksUrl(targetUrl, subId = 'shoppersdeals') {
  if (!targetUrl) return '';
  const channelId = process.env.CUELINKS_CHANNEL_ID || process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID || '325472';
  const subParam = subId ? `&subid=${encodeURIComponent(subId)}` : '&subid=shoppersdeals';
  return `https://linksredirect.com/?cid=${encodeURIComponent(channelId)}${subParam}&source=api&url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Converts a raw merchant URL into a monetized Cuelinks v3 affiliate tracking URL.
 * Automatically checks Redis and in-memory caches first.
 *
 * @param {string} targetUrl - Clean merchant product/store URL
 * @param {string} [subId='shoppersdeals'] - SubID for traffic attribution (e.g. 'web', 'tg', 'ext')
 * @param {boolean} [shorten=false] - Whether to generate a short clnk.in link
 * @returns {Promise<string>} Monetized affiliate URL
 */
export async function convertUrl(targetUrl, subId = 'shoppersdeals', shorten = false) {
  if (!targetUrl) return '';

  const cacheKey = `cuelinks:url:${hashUrl(`${targetUrl}:${subId}:${shorten}`)}`;

  // 1. Check in-memory LRU cache
  if (memoryUrlCache.has(cacheKey)) {
    return memoryUrlCache.get(cacheKey);
  }

  // 2. Check Redis cache
  try {
    const cached = await defaultRedis.get(cacheKey);
    if (cached) {
      memoryUrlCache.set(cacheKey, cached);
      return cached;
    }
  } catch (err) {
    // Non-fatal if Redis get fails
  }

  const apiKey = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY;

  // If no API key configured yet, immediately return clean fallback redirect
  if (!apiKey) {
    const fallback = getFallbackCuelinksUrl(targetUrl, subId);
    return fallback;
  }

  // 3. Call Cuelinks v3 Link Conversion API
  try {
    const channelId = Number(process.env.CUELINKS_CHANNEL_ID || process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID || 325472);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const res = await fetch(`${CUELINKS_BASE_URL}/links/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        subid: subId,
        channel_id: channelId,
        shorten: Boolean(shorten),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Cuelinks v3 Warning] Link conversion returned status ${res.status}: ${errText.slice(0, 150)}`);
      return getFallbackCuelinksUrl(targetUrl, subId);
    }

    const data = await res.json();
    const affiliateUrl =
      data?.affiliate_url ||
      data?.url ||
      data?.converted_url ||
      data?.data?.affiliate_url ||
      data?.data?.url;

    if (affiliateUrl) {
      // Store in memory & Redis with 7-day TTL
      if (memoryUrlCache.size >= MAX_CACHE_SIZE) {
        const firstKey = memoryUrlCache.keys().next().value;
        memoryUrlCache.delete(firstKey);
      }
      memoryUrlCache.set(cacheKey, affiliateUrl);

      try {
        await defaultRedis.set(cacheKey, affiliateUrl, 'EX', 60 * 60 * 24 * 7);
      } catch (redisErr) {}

      return affiliateUrl;
    }

    return getFallbackCuelinksUrl(targetUrl, subId);
  } catch (err) {
    console.warn(`[Cuelinks v3 Error] Failed to convert link: ${err.message}. Using fallback.`);
    return getFallbackCuelinksUrl(targetUrl, subId);
  }
}

/**
 * Fetches merchant campaigns and commission rates from Cuelinks API v3
 */
export async function getCampaigns({ page = 1, per_page = 20, access_status = 'open', sort = 'epc_7d', order = 'desc' } = {}) {
  const apiKey = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'CUELINKS_API_KEY is not configured', campaigns: [] };
  }

  const cacheKey = `cuelinks:campaigns:${page}:${per_page}:${access_status}:${sort}`;
  try {
    const cached = await defaultRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  try {
    const url = new URL(`${CUELINKS_BASE_URL}/campaigns`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(per_page));
    if (access_status) url.searchParams.set('access_status', access_status);
    if (sort) url.searchParams.set('sort', sort);
    if (order) url.searchParams.set('order', order);

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Cuelinks API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const result = { success: true, ...data };

    try {
      await defaultRedis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1-hour cache
    } catch (e) {}

    return result;
  } catch (err) {
    console.error('[Cuelinks v3 Error] getCampaigns failed:', err.message);
    return { success: false, error: err.message, campaigns: [] };
  }
}

/**
 * Fetches live promotional offers, discounts, and coupons from Cuelinks API v3
 */
export async function getOffers({ page = 1, per_page = 20, campaign_id = null, offer_type = null, search = null } = {}) {
  const apiKey = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'CUELINKS_API_KEY is not configured', offers: [] };
  }

  const cacheKey = `cuelinks:offers:${page}:${per_page}:${campaign_id || 'all'}:${offer_type || 'all'}:${search || 'all'}`;
  try {
    const cached = await defaultRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  try {
    const url = new URL(`${CUELINKS_BASE_URL}/offers`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(per_page));
    if (campaign_id) url.searchParams.set('campaign_id', String(campaign_id));
    if (offer_type) url.searchParams.set('offer_type', offer_type);
    if (search) url.searchParams.set('q', search);

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Cuelinks API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const result = { success: true, ...data };

    try {
      await defaultRedis.set(cacheKey, JSON.stringify(result), 'EX', 1800); // 30-min cache
    } catch (e) {}

    return result;
  } catch (err) {
    console.error('[Cuelinks v3 Error] getOffers failed:', err.message);
    return { success: false, error: err.message, offers: [] };
  }
}

/**
 * Convenience method to fetch verified coupon codes
 */
export async function getCoupons({ page = 1, per_page = 20, campaign_id = null, search = null } = {}) {
  return getOffers({ page, per_page, campaign_id, offer_type: 'coupon', search });
}

/**
 * Validates connection with Cuelinks v3 and checks API key validity
 */
export async function checkStatus() {
  const apiKey = process.env.CUELINKS_API_KEY || process.env.CUELINKS_V3_API_KEY || CUELINKS_API_KEY;
  const pubId = process.env.CUELINKS_PUB_ID || CUELINKS_PUB_ID;

  if (!apiKey) {
    return {
      configured: false,
      hasApiKey: false,
      pubId,
      message: 'CUELINKS_API_KEY is not set. Outbound links are using fallback Link Kit format.',
    };
  }

  try {
    const res = await fetch(`${CUELINKS_BASE_URL}/campaigns?per_page=1`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      return {
        configured: true,
        hasApiKey: true,
        valid: true,
        pubId,
        status: res.status,
        message: 'Cuelinks API v3 connected successfully! Scopes and access are active.',
      };
    } else {
      const err = await res.text().catch(() => '');
      return {
        configured: true,
        hasApiKey: true,
        valid: false,
        status: res.status,
        message: `Cuelinks API returned HTTP ${res.status}: ${err.slice(0, 100)}`,
      };
    }
  } catch (err) {
    return {
      configured: true,
      hasApiKey: true,
      valid: false,
      message: `Failed to connect to Cuelinks v3: ${err.message}`,
    };
  }
}

export default {
  convertUrl,
  getFallbackCuelinksUrl,
  getCampaigns,
  getOffers,
  getCoupons,
  checkStatus,
  isCuelinksConfigured,
};
