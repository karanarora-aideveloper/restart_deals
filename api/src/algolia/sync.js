import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import { algoliaClient, DEALS_INDEX, PRODUCTS_INDEX } from './client.js';

// Same rule as the web/native apps: a deal/product with no image, or a known-unreachable
// (localhost) image URL, is worthless to a shopper — keep it out of search entirely rather
// than surface a result with a broken photo.
function isUsableImageUrl(url) {
  if (!url) return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//i.test(url);
}

function getMerchant(urlOrMerchant) {
  const s = (urlOrMerchant || '').toLowerCase();
  if (s.includes('amazon') || s.includes('amzn')) return 'amazon';
  if (s.includes('flipkart') || s.includes('fkrt') || s.includes('fktr')) return 'flipkart';
  if (s.includes('myntra')) return 'myntra';
  if (s.includes('meesho')) return 'meesho';
  return s || 'other';
}

function dealToRecord(deal) {
  return {
    objectID: deal._id.toString(),
    type: 'deal',
    title: deal.title || '',
    description: deal.description || '',
    merchant: getMerchant(deal.dealUrl),
    category: deal.category || 'general',
    imageUrl: deal.imageUrl,
    dealUrl: deal.dealUrl,
    dealPrice: deal.dealPrice ?? null,
    originalPrice: deal.originalPrice ?? null,
    discountPercentage: deal.discountPercentage ?? 0,
    couponLabel: deal.coupon?.label || null,
    createdAt: deal.createdAt ? new Date(deal.createdAt).getTime() : 0,
  };
}

function productToRecord(product) {
  return {
    objectID: product._id.toString(),
    type: 'product',
    productId: product.productId,
    title: product.title || '',
    merchant: getMerchant(product.merchant),
    category: product.category || 'general',
    imageUrl: product.imageUrl,
    cleanUrl: product.cleanUrl,
    price: product.price ?? null,
    originalPrice: product.originalPrice ?? null,
    lastChecked: product.lastChecked ? new Date(product.lastChecked).getTime() : 0,
  };
}

// India-only, matching the api/deals and api/products routes' own country=in fallback: treat
// a missing/null country as India (older records predate the field) rather than excluding them.
const INDIA_QUERY = { $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] };

async function syncDeals() {
  const deals = await Deal.find(INDIA_QUERY).lean();
  // Same >90%-off cap as /api/deals (see api/src/routes/deals.js) — these are overwhelmingly bad
  // scrapes, not real discounts, and search must not surface them just because the REST route
  // filters them out. saveObjects only ever upserts by objectID, though — it never removes a
  // record that stops matching, which is why runAlgoliaSync also purges any already-indexed ones
  // below rather than relying on this filter alone to keep the index clean going forward.
  const records = deals
    .filter((d) => isUsableImageUrl(d.imageUrl) && !(d.discountPercentage > 90))
    .map(dealToRecord);
  if (records.length === 0) return 0;
  await algoliaClient.saveObjects({ indexName: DEALS_INDEX, objects: records });
  return records.length;
}

async function syncProducts() {
  const products = await Product.find({ ...INDIA_QUERY, isActive: true }).lean();
  const records = products.filter((p) => isUsableImageUrl(p.imageUrl)).map(productToRecord);
  if (records.length === 0) return 0;
  await algoliaClient.saveObjects({ indexName: PRODUCTS_INDEX, objects: records });
  return records.length;
}

async function configureIndexSettings() {
  await algoliaClient.setSettings({
    indexName: DEALS_INDEX,
    indexSettings: {
      searchableAttributes: ['title', 'description', 'merchant', 'category'],
      attributesForFaceting: ['category', 'merchant'],
      customRanking: ['desc(discountPercentage)', 'desc(createdAt)'],
    },
  });
  await algoliaClient.setSettings({
    indexName: PRODUCTS_INDEX,
    indexSettings: {
      searchableAttributes: ['title', 'merchant', 'category'],
      attributesForFaceting: ['category', 'merchant'],
      customRanking: ['desc(lastChecked)'],
    },
  });
}

let configured = false;

export async function runAlgoliaSync() {
  if (!algoliaClient) return;
  try {
    if (!configured) {
      await configureIndexSettings();
      // One-time cleanup of whatever's already sitting in the index from before the >90%-off
      // cap above existed — syncDeals's own filter only stops new ones from being added, it
      // can't retroactively clear records saveObjects already upserted in past sync cycles.
      try {
        await algoliaClient.deleteBy({
          indexName: DEALS_INDEX,
          deleteByParams: { numericFilters: ['discountPercentage > 90'] },
        });
      } catch (cleanupErr) {
        console.error('[Algolia] One-time >90%-off cleanup failed:', cleanupErr.message);
      }
      configured = true;
    }
    const [dealCount, productCount] = await Promise.all([syncDeals(), syncProducts()]);
    console.log(`[Algolia] Synced ${dealCount} deals, ${productCount} products`);
  } catch (err) {
    console.error('[Algolia] Sync failed:', err.message);
  }
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — catalog is small (~2.4k items), cheap to resync

// Runs once immediately, then on a fixed interval. Intentionally a full resync each time (not
// incremental) — simplest correct option while the ingestion pipeline (backend/, scrapingant/)
// has no hooks to trigger a push on individual create/update. Revisit if the catalog grows large
// enough that a full resync becomes slow or costly.
export function startAlgoliaSync() {
  if (!algoliaClient) return;
  runAlgoliaSync();
  setInterval(runAlgoliaSync, SYNC_INTERVAL_MS);
}
