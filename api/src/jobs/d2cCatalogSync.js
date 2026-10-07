import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import { D2C_STORES } from '../config/d2cStores.js';
import { apiCache } from '../utils/cache.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';
import { extractVariant } from '../utils/variantExtractor.js';

let isSyncing = false;

/**
 * Fetch and normalize products from a single Shopify-based D2C store
 */
export async function fetchStoreProducts(store, maxItems = 40) {
  try {
    const res = await fetch(store.catalogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      console.warn(`[D2C Sync] ⚠️ ${store.name} returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rawProducts = data.products || [];

    const validProducts = rawProducts.filter(p => {
      if (!p.title || !p.handle) return false;
      const v = p.variants?.[0];
      if (!v || !v.price || parseFloat(v.price) <= 0) return false;
      const tags = (p.tags || []).map(t => String(t).toLowerCase());
      if (tags.some(t => t.includes('hide') || t.includes('free-gift') || t.includes('gift-card') || t.includes('test'))) {
        return false;
      }
      return true;
    });

    return validProducts.slice(0, maxItems).map(p => {
      const v = p.variants[0];
      const rawPrice = parseFloat(v.price);
      const rawMrp = v.compare_at_price ? parseFloat(v.compare_at_price) : null;
      const price = Math.round(rawPrice);
      const originalPrice = rawMrp && rawMrp >= price ? Math.round(rawMrp) : price;
      const cleanTitle = p.title.replace(/\s+/g, ' ').trim();
      const images = (p.images || []).map(img => img.src).filter(Boolean);

      return {
        productId: p.handle.toLowerCase(),
        merchant: store.merchant,
        cleanUrl: `https://${store.domains[0]}/products/${p.handle}`,
        title: cleanTitle,
        price,
        originalPrice,
        imageUrl: images[0] || null,
        images: images.slice(0, 5),
        rating: 4.4,
        category: store.category,
        subcategory: store.subcategory,
        variant: extractVariant(cleanTitle),
        isActive: true,
        country: 'IN',
        currency: 'INR',
      };
    });
  } catch (err) {
    console.error(`[D2C Sync] Error fetching ${store.name}:`, err.message);
    return [];
  }
}

/**
 * Sweeps all 19 D2C stores once a day, upserting products into the catalog
 * and autonomously synthesizing genuine price-drop deals.
 */
export async function syncAllD2CStores(options = {}) {
  if (isSyncing) {
    console.log('[D2C Sync] Already running — skipping duplicate invocation.');
    return { status: 'already_running' };
  }

  isSyncing = true;
  const maxItemsPerStore = options.maxItemsPerStore || 35;
  const stats = {
    storesProcessed: 0,
    productsEnrolled: 0,
    productsUpdated: 0,
    dealsSynthesized: 0,
    errors: 0
  };

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  console.log(`[D2C Sync] Starting daily D2C catalog sweep across ${D2C_STORES.length} stores (max ${maxItemsPerStore} items/store)...`);

  try {
    for (const store of D2C_STORES) {
      try {
        const products = await fetchStoreProducts(store, maxItemsPerStore);
        stats.storesProcessed++;

        for (const prodData of products) {
          const existing = await Product.findOne({ productId: prodData.productId, merchant: prodData.merchant });

          if (existing) {
            existing.isActive = true;
            existing.lastStoreSyncAt = now;
            existing.lastChecked = now;
            if (prodData.imageUrl && !existing.imageUrl) {
              existing.imageUrl = prodData.imageUrl;
              existing.images = prodData.images;
            }

            // Check for price drop
            if (prodData.price && prodData.price !== existing.price) {
              const priorPrice = existing.price;
              existing.previousPrice = priorPrice;
              existing.price = prodData.price;
              existing.priceUpdatedAt = now;

              if (!Array.isArray(existing.priceHistory)) existing.priceHistory = [];
              const dayIdx = existing.priceHistory.findIndex(e => e.date === todayStr);
              if (dayIdx >= 0) {
                if (prodData.price < existing.priceHistory[dayIdx].price) {
                  existing.priceHistory[dayIdx].price = prodData.price;
                  existing.priceHistory[dayIdx].timestamp = now;
                }
              } else {
                existing.priceHistory.push({
                  date: todayStr,
                  price: prodData.price,
                  originalPrice: prodData.originalPrice || existing.originalPrice,
                  timestamp: now
                });
              }
              if (existing.priceHistory.length > 90) {
                existing.priceHistory = existing.priceHistory.slice(-90);
              }

              // Autonomous deal synthesis on genuine drop
              if (priorPrice && priorPrice > prodData.price) {
                const genuineDiscount = Math.round(((priorPrice - prodData.price) / priorPrice) * 100);
                const cashDrop = priorPrice - prodData.price;
                const thresholdCheck = meetsCategoryThreshold(existing.category, existing.subcategory, genuineDiscount, cashDrop, 'IN');

                if (thresholdCheck.qualifies) {
                  const deal = new Deal({
                    sourceChannelId: 'd2c_engine',
                    sourceMessageId: `d2c_${prodData.productId}_${Date.now()}`,
                    sourceChannelName: `${store.name} D2C Discovery`,
                    sourceEngine: 'engine2',
                    hasPriceHistory: true,
                    originalText: `Price Drop on ${store.name}: ${existing.title} at ₹${prodData.price}`,
                    title: existing.title,
                    description: `Price drop on ${store.name} official store. Dropped from ₹${priorPrice} to ₹${prodData.price}.`,
                    imageUrl: existing.imageUrl || (existing.images && existing.images[0]) || null,
                    images: existing.images || (existing.imageUrl ? [existing.imageUrl] : []),
                    rating: existing.rating || 4.4,
                    dealUrl: existing.cleanUrl,
                    productId: existing.productId,
                    merchant: existing.merchant,
                    originalPrice: existing.originalPrice || prodData.originalPrice,
                    dealPrice: prodData.price,
                    previousPrice: priorPrice,
                    discountPercentage: genuineDiscount,
                    priceSource: 'price_history',
                    category: existing.category || 'beauty',
                    subcategory: existing.subcategory || 'skincare',
                    isVerified: true,
                    isExpired: false,
                    lastVerifiedAt: now,
                    country: 'IN',
                    createdAt: now,
                    updatedAt: now
                  });
                  await deal.save();
                  apiCache.invalidatePattern('/api/deals');
                  enqueueDealForPublishing(deal._id, { sourceEngine: 'd2c_engine' }).catch(() => {});
                  evaluateAndTriggerPriceAlerts({
                    productId: existing.productId,
                    livePrice: prodData.price,
                    title: existing.title,
                    dealUrl: existing.cleanUrl,
                    imageUrl: existing.imageUrl,
                    merchant: existing.merchant,
                    category: existing.category,
                    subcategory: existing.subcategory
                  }).catch(() => {});
                  stats.dealsSynthesized++;
                }
              } else if (priorPrice && prodData.price > priorPrice) {
                // Price reverted or increased — expire active deal
                await Deal.updateMany(
                  { productId: existing.productId, isExpired: false },
                  { $set: { isExpired: true, expiredAt: now, expiryReason: 'price_reverted' } }
                );
              }
            }

            existing.hasPriceHistory = Boolean(existing.priceHistory && existing.priceHistory.length >= 2);
            await existing.save();
            stats.productsUpdated++;
          } else {
            // New product enrollment
            const newProduct = new Product({
              ...prodData,
              isTop20: true,
              top20Category: prodData.category,
              top20Subcategory: prodData.subcategory,
              productSource: 'd2c_catalog',
              priceHistory: [{ date: todayStr, price: prodData.price, originalPrice: prodData.originalPrice, timestamp: now }],
              lastStoreSyncAt: now,
              lastChecked: now,
              priceUpdatedAt: now,
              createdAt: now,
              updatedAt: now
            });
            await newProduct.save();
            stats.productsEnrolled++;
          }
        }

        console.log(`[D2C Sync]  ✓ ${store.name.padEnd(20)}: Processed ${products.length} products`);
      } catch (storeErr) {
        console.error(`[D2C Sync] Error processing store ${store.name}:`, storeErr.message);
        stats.errors++;
      }
    }
  } finally {
    isSyncing = false;
  }

  console.log(`[D2C Sync] Completed daily sweep:`, stats);
  return stats;
}

/**
 * Initializes the Daily D2C Cron Schedule.
 * Runs once every 24 hours at 03:30 AM IST.
 */
export function initD2CCatalogSync() {
  console.log('[D2C Sync] Initializing Daily D2C Catalog Cron (03:30 AM IST every day)...');
  cron.schedule('30 3 * * *', async () => {
    console.log('[D2C Sync] Running scheduled daily D2C sync...');
    try {
      await syncAllD2CStores();
    } catch (e) {
      console.error('[D2C Sync] Scheduled job failed:', e);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Run initial sync 35 seconds after server startup
  setTimeout(() => {
    syncAllD2CStores({ maxItemsPerStore: 25 }).catch(err => {
      console.warn('[D2C Sync] Initial startup sync warning:', err.message);
    });
  }, 35000);
}

export default {
  syncAllD2CStores,
  fetchStoreProducts,
  initD2CCatalogSync
};
