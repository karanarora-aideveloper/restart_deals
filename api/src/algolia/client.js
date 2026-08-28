import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_API_KEY = process.env.ALGOLIA_ADMIN_API_KEY;

export const DEALS_INDEX = 'deals';
export const PRODUCTS_INDEX = 'products';

// Admin client — write access, server-side only. Never expose ALGOLIA_ADMIN_API_KEY to any
// client (web/native); those use the separate search-only key instead.
export const algoliaClient = APP_ID && ADMIN_API_KEY ? algoliasearch(APP_ID, ADMIN_API_KEY) : null;

if (!algoliaClient) {
  console.warn('[Algolia] ALGOLIA_APP_ID / ALGOLIA_ADMIN_API_KEY not set — search indexing disabled.');
}
