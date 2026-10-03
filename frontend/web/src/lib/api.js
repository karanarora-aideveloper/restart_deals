import { API_BASE_URL } from './config';
import { isUsableImageUrl } from './affiliate';
import { searchAlgolia, hitToDeal, hitToProduct, DEALS_INDEX, PRODUCTS_INDEX } from './algolia';
import { aggregateSeriesFeed } from './seriesAggregation';
import {
  directFetchProductById,
  directFetchDealById,
  directFetchProductVariants,
  directFindMatchingProductId,
  directFindLatestDealForProduct,
  directFetchTopProductsForSubcategory,
  directFetchSitemapProducts,
  directFetchSitemapDeals,
} from './dbFallback';

// Server-side data fetching helpers, used from Server Components / route handlers.
// `revalidate` keeps pages fast to build while still refreshing frequently — deals
// change within a 5-minute refresh window, so pages that show them opt into a 5-minute refresh window
// (or `no-store` where freshness matters more than cache hits) and layer client-side
// polling on top for the "live" feel the native app has.

async function safeFetchJson(url, options = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(`[api] fetch failed for ${url}:`, err.message);
    }
    return null;
  }
}

export async function fetchDeals({
  page = 1,
  limit = 40,
  q = '',
  category = 'all',
  merchant = 'all',
  country = 'in',
  sort = 'newest',
  revalidate = 300,
  minDiscount = 0,
} = {}) {
  if (q.trim()) {
    const facetFilters = [];
    if (category && category !== 'all') facetFilters.push(`category:${category}`);
    if (merchant && merchant !== 'all') facetFilters.push(`merchant:${merchant}`);
    const res = await searchAlgolia({
      indexName: DEALS_INDEX,
      query: q.trim(),
      page: page - 1,
      hitsPerPage: limit,
      facetFilters: facetFilters.length > 0 ? facetFilters : undefined,
    });
    let raw = res.hits.map(hitToDeal);
    if (category && category !== 'all') {
      raw = raw.filter((d) => !d.category || d.category === category || d.category === 'all');
    }
    if (minDiscount > 0) {
      raw = raw.filter((d) => (d.discountPercentage || 0) >= minDiscount);
    }
    // Fallback: If no promotional deals found for the query, search the permanent PRODUCTS catalog
    // so shoppers discover the tracked item with its 90-day price history & cross-store comparison
    if (raw.length === 0) {
      const prodRes = await searchAlgolia({
        indexName: PRODUCTS_INDEX,
        query: q.trim(),
        page: page - 1,
        hitsPerPage: limit,
        facetFilters: facetFilters.length > 0 ? facetFilters : undefined,
      });
      raw = prodRes.hits.map((hit) => {
        const prod = hitToProduct(hit);
        const discountPct = (prod.originalPrice && prod.price && prod.originalPrice > prod.price)
          ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
          : 0;
        return {
          _id: prod._id,
          id: prod._id,
          title: prod.title,
          dealUrl: prod.cleanUrl,
          imageUrl: prod.imageUrl,
          dealPrice: prod.price,
          originalPrice: prod.originalPrice,
          previousPrice: prod.previousPrice,
          discountPercentage: discountPct,
          merchant: prod.merchant,
          category: prod.category,
          subcategory: prod.subcategory,
          linkedProductId: prod._id,
          resolvedToProduct: true,
        };
      });
    }
    const finalItems = aggregateSeriesFeed(raw.filter((d) => isUsableImageUrl(d.imageUrl)));
    return { items: finalItems, hasMore: page < res.nbPages };
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    q,
    category,
    merchant,
    country: (country || 'in').toLowerCase(),
    sort,
  });
  const json = await safeFetchJson(`${API_BASE_URL}/api/deals?${params}`, {
    next: { revalidate },
  });
  let raw = json?.data || json?.deals || [];
  // Apply minimum discount quality filter to keep junk off the main feed.
  // This is done client-side since the backend API doesn't yet support the param.
  if (minDiscount > 0) {
    raw = raw.filter((d) => (d.discountPercentage || 0) >= minDiscount);
  }
  // hasMore reflects what the API actually had for this page — computed before the image
  // filter below so a page that happens to be mostly imageless doesn't look like "no more
  // results" and cut pagination short.
  const finalItems = aggregateSeriesFeed(raw.filter((d) => isUsableImageUrl(d.imageUrl)));
  // Guarantee strict newest-first sorting by authentic deal publication timestamp
  const sortedItems = [...finalItems].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.postedAt || a.updatedAt || a.lastVerifiedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.postedAt || b.updatedAt || b.lastVerifiedAt || 0).getTime();
    return timeB - timeA;
  });
  return { items: sortedItems, hasMore: raw.length >= limit };
}

export async function fetchDealById(id) {
  if (!id) return null;
  const json = await safeFetchJson(`${API_BASE_URL}/api/deals/${id}`, {
    next: { revalidate: 300 },
  });
  if (json?.success && json.data) {
    return json.data;
  }
  return await directFetchDealById(id);
}

export async function fetchProducts({
  page = 1,
  limit = 40,
  q = '',
  category = 'all',
  subcategory = 'all',
  merchant = 'all',
  country = 'in',
  sort = 'recently_checked',
  revalidate = 300,
} = {}) {
  if (q.trim()) {
    const facetFilters = [];
    if (category && category !== 'all') facetFilters.push(`category:${category}`);
    if (merchant && merchant !== 'all') facetFilters.push(`merchant:${merchant}`);
    const res = await searchAlgolia({
      indexName: PRODUCTS_INDEX,
      query: q.trim(),
      page: page - 1,
      hitsPerPage: limit,
      facetFilters: facetFilters.length > 0 ? facetFilters : undefined,
    });
    let raw = res.hits.map(hitToProduct);
    if (category && category !== 'all') {
      raw = raw.filter((p) => !p.category || p.category === category || p.category === 'all');
    }
    const finalItems = aggregateSeriesFeed(raw.filter((p) => isUsableImageUrl(p.imageUrl)));
    return { items: finalItems, hasMore: page < res.nbPages };
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    q,
    category,
    merchant,
    country: (country || 'in').toLowerCase(),
    sort,
  });
  if (subcategory && subcategory !== 'all') {
    params.set('subcategory', subcategory);
  }
  const json = await safeFetchJson(`${API_BASE_URL}/api/products?${params}`, {
    next: { revalidate },
  });
  const raw = json?.data || json?.deals || [];
  const finalItems = aggregateSeriesFeed(raw.filter((p) => isUsableImageUrl(p.imageUrl)));
  return { items: finalItems, hasMore: raw.length >= limit };
}

export async function fetchTopProductsForSubcategory({ subcategory, category = 'all', limit = 20 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    sort: 'rating',
    imageStatus: 'has_image',
    country: 'in',
  });
  if (subcategory && subcategory !== 'all') params.set('subcategory', subcategory);
  if (category && category !== 'all') params.set('category', category);

  const json = await safeFetchJson(`${API_BASE_URL}/api/products?${params}`, {
    next: { revalidate: 300 },
  });
  const raw = json?.data || json?.products || [];
  if (raw.length > 0) {
    const finalItems = aggregateSeriesFeed(raw.filter((p) => isUsableImageUrl(p.imageUrl)));
    return finalItems.slice(0, limit);
  }
  return await directFetchTopProductsForSubcategory({ subcategory, category, limit });
}

export async function fetchProductById(id) {
  if (!id) return null;
  const json = await safeFetchJson(`${API_BASE_URL}/api/products/${id}`, {
    next: { revalidate: 300 },
  });
  if (json?.success && json.data) {
    return json.data;
  }
  // Architectural Safeguard: Direct MongoDB fallback when API is slow or unreachable
  return await directFetchProductById(id);
}

export async function fetchProductVariants(id) {
  if (!id) return null;
  const json = await safeFetchJson(`${API_BASE_URL}/api/products/${id}/variants`, {
    next: { revalidate: 300 },
  });
  if (json?.success) {
    return json;
  }
  return await directFetchProductVariants(id);
}

// A Deal's `productId`+`merchant` is the same canonical identity Product tracks (see the
// comment on Deal.productId in the backend schema) — most deals resolve to an existing
// tracked Product. Used to redirect /deal/[id] to its canonical /product/[id] and to avoid
// listing both as separate indexable URLs (near-duplicate content otherwise).
export async function findMatchingProductId(productId, merchant) {
  if (!productId || !merchant) return null;
  const json = await safeFetchJson(
    `${API_BASE_URL}/api/products?q=${encodeURIComponent(productId)}&limit=5`,
    { next: { revalidate: 300 } }
  );
  const match = (json?.data || []).find(
    (p) => p.productId === productId && (p.merchant || '').toLowerCase() === merchant.toLowerCase()
  );
  if (match?._id) return match._id;
  return await directFindMatchingProductId(productId, merchant);
}

// Reverse lookup for the product page: the most recent Deal posted for this product, if any,
// so the product page can surface "just dropped" urgency/coupon context that used to live only
// on the (now-redirected) deal page.
export async function findLatestDealForProduct(productId, merchant, country = 'in') {
  if (!productId || !merchant) return null;
  const json = await safeFetchJson(
    `${API_BASE_URL}/api/deals?q=${encodeURIComponent(productId)}&limit=5&sort=newest&country=${encodeURIComponent((country || 'in').toLowerCase())}`,
    { next: { revalidate: 300 } }
  );
  const matches = (json?.data || []).filter(
    (d) => d.productId === productId && (d.merchant || '').toLowerCase() === merchant.toLowerCase()
  );
  if (matches[0]) return matches[0];
  return await directFindLatestDealForProduct(productId, merchant, country);
}

// Pages through an endpoint collecting every item — used for the sitemap, which needs every
// deal/product id, not just one page. Capped well above current volume (a few thousand) as a
// runaway backstop, not a real limit; bump PAGE_CAP if the catalog ever legitimately exceeds it.
async function fetchAllPaginated(path, { pageSize = 500, sort, revalidate = 3600 } = {}) {
  const PAGE_CAP = 40; // pageSize(500) * 40 = 20,000 items ceiling
  const results = [];
  for (let page = 1; page <= PAGE_CAP; page++) {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize), country: 'in' });
    if (sort) params.set('sort', sort);
    const json = await safeFetchJson(`${API_BASE_URL}${path}?${params}`, { next: { revalidate } });
    const batch = json?.data || json?.deals || [];
    results.push(...batch);
    const total = json?.pagination?.total;
    if (batch.length < pageSize || (typeof total === 'number' && results.length >= total)) break;
  }
  return results;
}

export async function fetchSitemapData() {
  const json = await safeFetchJson(`${API_BASE_URL}/api/seo/sitemap-data`, {
    next: { revalidate: 1800 },
    timeoutMs: 25000,
  });
  if (json?.success && Array.isArray(json.products) && Array.isArray(json.deals)) {
    return { products: json.products, deals: json.deals };
  }
  // Safe quick fallback: avoid heavy sequential pagination loop during build
  return { deals: [], products: [] };
}

export async function fetchSitemapSummary() {
  const json = await safeFetchJson(`${API_BASE_URL}/api/seo/sitemap-summary`, {
    next: { revalidate: 3600 },
    timeoutMs: 10000,
  });
  if (json?.success) {
    return json;
  }
  // Safe default fallback: 2 IN chunks, 2 US chunks
  return {
    success: true,
    chunkSize: 5000,
    inChunks: 2,
    usChunks: 2,
  };
}

export async function fetchSitemapProducts({ country = 'IN', page = 1, limit = 5000 } = {}) {
  const json = await safeFetchJson(
    `${API_BASE_URL}/api/seo/sitemap-products?country=${encodeURIComponent(country)}&page=${page}&limit=${limit}`,
    {
      next: { revalidate: 7200 },
      timeoutMs: 15000,
    }
  );
  if (json?.success && Array.isArray(json.products) && json.products.length > 0) {
    return json.products;
  }
  return await directFetchSitemapProducts({ country, page, limit });
}

export async function fetchSitemapDeals() {
  const json = await safeFetchJson(`${API_BASE_URL}/api/seo/sitemap-deals`, {
    next: { revalidate: 1800 },
    timeoutMs: 15000,
  });
  if (json?.success && Array.isArray(json.deals) && json.deals.length > 0) {
    return json.deals;
  }
  return await directFetchSitemapDeals();
}

export function fetchAllDeals(opts) {
  return fetchAllPaginated('/api/deals', { sort: 'newest', ...opts });
}

export function fetchAllProducts(opts) {
  return fetchAllPaginated('/api/products', { sort: 'recently_checked', ...opts });
}

