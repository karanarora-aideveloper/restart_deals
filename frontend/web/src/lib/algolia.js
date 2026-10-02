// Plain isomorphic module (no 'use client') — Algolia's v5 client works via fetch in both Node
// (SSR, called from api.js's server components) and the browser (DealsFeed's client-side poll
// and infinite scroll), so this is imported from both without a client-boundary directive.
import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const DEALS_INDEX = 'deals';
export const PRODUCTS_INDEX = 'products';

// Search-only key — safe for the browser. Write access (indexing) lives only on api/, using a
// separate admin key that never reaches client code.
export const algoliaClient = APP_ID && SEARCH_KEY ? algoliasearch(APP_ID, SEARCH_KEY) : null;

// Maps an Algolia `deals` hit back to the shape DealCard already expects, so no card code needs
// to know or care whether an item came from the regular listing API or a search result.
export function hitToDeal(hit) {
  return {
    _id: hit.objectID,
    title: hit.title,
    description: hit.description,
    imageUrl: hit.imageUrl,
    dealUrl: hit.dealUrl,
    dealPrice: hit.dealPrice,
    originalPrice: hit.originalPrice,
    previousPrice: hit.previousPrice,
    priceSource: hit.priceSource,
    discountPercentage: hit.discountPercentage,
    coupon: hit.couponLabel ? { label: hit.couponLabel } : null,
    createdAt: hit.createdAt,
    category: hit.category,
    subcategory: hit.subcategory,
  };
}

// Same, for the `products` index → ProductCard's expected shape.
export function hitToProduct(hit) {
  return {
    _id: hit.objectID,
    productId: hit.productId,
    title: hit.title,
    imageUrl: hit.imageUrl,
    cleanUrl: hit.cleanUrl,
    merchant: hit.merchant,
    price: hit.price,
    originalPrice: hit.originalPrice,
    priceUpdatedAt: hit.lastChecked,
    category: hit.category,
    subcategory: hit.subcategory,
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True if `query` appears as a complete, standalone word/phrase in `text` (not merely as a
// prefix of a longer word — "lip" should count against "Lip Balm" but not "Liposomal").
function isExactWordMatch(text, query) {
  if (!text || !query) return false;
  return new RegExp(`\\b${escapeRegExp(query)}\\b`, 'i').test(text);
}

// `page` is 0-indexed, matching Algolia's own convention — callers translate from the app's
// 1-indexed page state at the call site (same reason DealsFeed does it for the backend API).
export async function searchAlgolia({ indexName, query, page = 0, hitsPerPage = 40, facetFilters }) {
  if (!algoliaClient) return { hits: [], nbPages: 0, page: 0, nbHits: 0 };
  try {
    const searchParams = { query, page, hitsPerPage };
    if (facetFilters && facetFilters.length > 0) {
      searchParams.facetFilters = facetFilters;
    }
    const res = await algoliaClient.searchSingleIndex({ indexName, searchParams });
    const q = query.trim();
    if (!q) return res;

    // Algolia's prefix search (queryType: prefixLast, the default — needed so results start
    // appearing while a shopper is still mid-word, e.g. typing "lipst" already surfacing
    // "Lipstick") scores any prefix match as equally relevant whether it's the start of a
    // related word ("Lipstick") or a totally unrelated one ("Liposomal" for query "lip") — its
    // own "exact" ranking tier doesn't apply to the last (still-being-typed) query word, so nb.
    // Re-rank so hits where the query matches a complete word in the title come first; this is
    // exactly the signal Algolia's "exact" tier is supposed to provide but doesn't here. Stable
    // sort — hits within each group keep Algolia's own relevance order.
    const reranked = res.hits
      .map((hit, i) => ({ hit, i, exact: isExactWordMatch(hit.title, q) }))
      .sort((a, b) => (b.exact === a.exact ? a.i - b.i : b.exact - a.exact))
      .map((x) => x.hit);
    return { ...res, hits: reranked };
  } catch (err) {
    console.error('[Algolia] search failed:', err.message);
    return { hits: [], nbPages: 0, page: 0, nbHits: 0 };
  }
}
