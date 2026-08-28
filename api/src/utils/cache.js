/**
 * High-Performance In-Memory TTL Cache Engine
 * 
 * Provides sub-millisecond (< 1ms) response times for frequent public API queries
 * (deal feeds, categories, product lookup, hot deals) with automatic TTL eviction.
 */

class MemoryCache {
  constructor(maxItems = 1000) {
    this.cache = new Map();
    this.maxItems = maxItems;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlSeconds = 30) {
    // Prevent unbounded memory growth
    if (this.cache.size >= this.maxItems) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  invalidatePattern(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new MemoryCache(2000);

/**
 * Express middleware for sub-millisecond caching of GET requests.
 */
export function cacheMiddleware(ttlSeconds = 20) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const cacheKey = `${req.baseUrl || ''}${req.path}?${JSON.stringify(req.query || {})}`;
    const cachedData = apiCache.get(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Capture res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success) {
        apiCache.set(cacheKey, body, ttlSeconds);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
