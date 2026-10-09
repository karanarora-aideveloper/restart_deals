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
  if (s.includes('shopsy')) return 'shopsy';
  if (s.includes('flipkart') || s.includes('fkrt') || s.includes('fktr')) return 'flipkart';
  if (s.includes('myntra')) return 'myntra';
  if (s.includes('meesho')) return 'meesho';
  if (s.includes('nykaa')) return 'nykaa';
  if (s.includes('ajio')) return 'ajio';
  if (s.includes('croma')) return 'croma';
  if (s.includes('plum')) return 'plum';
  if (s.includes('mamaearth')) return 'mamaearth';
  if (s.includes('dermaco') || s.includes('derma co')) return 'thedermaco';
  if (s.includes('minimalist')) return 'minimalist';
  if (s.includes('boat')) return 'boat';
  if (s.includes('noise')) return 'noise';
  if (s.includes('boult')) return 'boult';
  if (s.includes('portronics')) return 'portronics';
  if (s.includes('snitch')) return 'snitch';
  if (s.includes('xyxx')) return 'xyxx';
  if (s.includes('sugar')) return 'sugar';
  if (s.includes('mcaffeine')) return 'mcaffeine';
  if (s.includes('dotandkey')) return 'dotandkey';
  if (s.includes('drsheths')) return 'drsheths';
  if (s.includes('bblunt')) return 'bblunt';
  if (s.includes('foxtale')) return 'foxtale';
  if (s.includes('aqualogica')) return 'aqualogica';
  if (s.includes('bombayshaving')) return 'bombayshaving';
  if (s.includes('huft')) return 'huft';
  if (!s.includes('/') && !s.includes('.')) return s;
  return 'generic';
}

function dealToRecord(deal) {
  return {
    objectID: deal._id.toString(),
    type: 'deal',
    title: deal.title || '',
    description: deal.description || '',
    merchant: getMerchant(deal.merchant || deal.dealUrl),
    category: deal.category || 'home',
    subcategory: deal.subcategory || 'decor',
    imageUrl: deal.imageUrl,
    dealUrl: deal.dealUrl,
    dealPrice: deal.dealPrice ?? null,
    originalPrice: deal.originalPrice ?? null,
    // Needed to tell a genuine price-drop deal (no originalPrice by definition — see
    // verifier.js) apart from an MRP-based one once this record reaches the app; without both,
    // a price_history deal's discount badge shows with no "was ₹X" context at all.
    previousPrice: deal.previousPrice ?? null,
    priceSource: deal.priceSource ?? null,
    discountPercentage: deal.discountPercentage ?? 0,
    couponLabel: deal.coupon?.label || null,
    createdAt: deal.createdAt ? new Date(deal.createdAt).getTime() : 0,
  };
}

function productToRecord(product) {
  const img = product.imageUrl || (product.images && product.images[0]) || '';
  return {
    objectID: product._id.toString(),
    type: 'product',
    productId: product.productId,
    title: product.title || '',
    brand: product.brand || '',
    merchant: getMerchant(product.merchant),
    category: product.category || 'home',
    subcategory: product.subcategory || 'decor',
    imageUrl: img,
    cleanUrl: product.cleanUrl,
    price: product.price ?? null,
    originalPrice: product.originalPrice ?? null,
    previousPrice: product.previousPrice ?? null,
    rating: product.rating ?? null,
    country: product.country || 'IN',
    lastChecked: product.lastChecked ? new Date(product.lastChecked).getTime() : 0,
  };
}

// India-only, matching the api/deals and api/products routes' own country=in fallback: treat
// a missing/null country as India (older records predate the field) rather than excluding them.
const INDIA_QUERY = { $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] };

export async function syncDeals() {
  const deals = await Deal.find({ ...INDIA_QUERY, isExpired: { $ne: true } }).lean();
  // Same >90%-off cap as /api/deals (see api/src/routes/deals.js) — these are overwhelmingly bad
  // scrapes, not real discounts, and search must not surface them just because the REST route
  // filters them out. saveObjects only ever upserts by objectID, though — it never removes a
  // record that stops matching, which is why runAlgoliaSync also purges any already-indexed ones
  // below rather than relying on this filter alone to keep the index clean going forward.
  const records = deals
    .filter((d) => isUsableImageUrl(d.imageUrl) && !(d.discountPercentage > 90))
    .map(dealToRecord);
  if (records.length === 0) return 0;
  await algoliaClient.replaceAllObjects({ indexName: DEALS_INDEX, objects: records });
  return records.length;
}

export async function syncProducts() {
  const products = await Product.find({ ...INDIA_QUERY, isActive: true })
    .select('_id productId title brand merchant category subcategory imageUrl images cleanUrl price originalPrice previousPrice rating country lastChecked')
    .lean();
  const records = products
    .filter((p) => isUsableImageUrl(p.imageUrl || (p.images && p.images[0])))
    .map(productToRecord);
  if (records.length === 0) return 0;
  await algoliaClient.replaceAllObjects({ indexName: PRODUCTS_INDEX, objects: records });
  return records.length;
}

async function configureIndexSettings() {
  await algoliaClient.setSettings({
    indexName: DEALS_INDEX,
    indexSettings: {
      searchableAttributes: ['title', 'description', 'merchant', 'category'],
      attributesForFaceting: ['category', 'subcategory', 'merchant'],
      customRanking: ['desc(discountPercentage)', 'desc(createdAt)'],
    },
  });
  await algoliaClient.setSettings({
    indexName: PRODUCTS_INDEX,
    indexSettings: {
      searchableAttributes: ['title', 'brand', 'productId', 'merchant', 'category', 'subcategory'],
      attributesForFaceting: ['category', 'subcategory', 'merchant', 'country'],
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
