import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import { fetchBuyhatkePriceHistory } from '../services/buyhatkeService.js';
import { computePriceStats } from '../utils/priceAnalytics.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { apiCache } from '../utils/cache.js';

let isBackfilling = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Paced background worker that enriches catalog products with authentic 90-365 day price history
 * from Buyhatke, and autonomously synthesizes verified deals if a genuine price drop is detected.
 * Strictly adheres to the Zero-MRP rule: deals are only created against historical selling prices.
 *
 * @param {number} [batchSize=20] Number of products to process per batch
 */
export async function backfillCatalogPriceHistory(batchSize = 20) {
  if (isBackfilling) {
    return { skipped: true, reason: 'already_running' };
  }

  isBackfilling = true;
  const stats = {
    processed: 0,
    historyHydrated: 0,
    dealsSynthesized: 0,
    fakeMrpSkipped: 0,
    notFound: 0,
    errors: 0
  };

  const now = new Date();

  try {
    // Target Indian products from supported merchants that lack multi-point price history
    const candidates = await Product.find({
      country: 'IN',
      merchant: { $in: ['amazon', 'flipkart', 'myntra', 'nykaa', 'croma', 'ajio'] },
      isActive: { $ne: false },
      $or: [
        { hasPriceHistory: false },
        { hasPriceHistory: { $exists: false } },
        { 'priceHistory.1': { $exists: false } }
      ]
    })
    .sort({ lastBuyhatkeSyncAt: 1, createdAt: -1 })
    .limit(batchSize);

    if (candidates.length === 0) {
      isBackfilling = false;
      return { skipped: true, reason: 'no_candidates' };
    }

    console.log(`[PriceHistory Backfill] Starting batch of ${candidates.length} products...`);

    for (const prod of candidates) {
      stats.processed++;
      try {
        const checkpoints = await fetchBuyhatkePriceHistory(
          prod.productId,
          prod.title,
          prod.merchant,
          prod.price,
          prod.originalPrice
        );

        prod.lastBuyhatkeSyncAt = now;

        if (checkpoints && checkpoints.length >= 2) {
          prod.priceHistory = checkpoints.slice(-90); // 90-day compaction
          prod.hasPriceHistory = true;
          stats.historyHydrated++;

          // ─── STRICT ZERO-MRP DEAL EVALUATION ─────────────────────────────
          const priceStats = computePriceStats(prod);

          if (priceStats && !priceStats.isFakeMrpDiscount) {
            let genuinePrevPrice = null;
            let genuineDiscountPct = 0;
            let genuineCashDrop = 0;

            const livePrice = prod.price || priceStats.currentPrice;

            if (priceStats.previousPrice && priceStats.previousPrice > livePrice) {
              genuinePrevPrice = priceStats.previousPrice;
              genuineCashDrop = priceStats.previousPrice - livePrice;
              genuineDiscountPct = Math.round((genuineCashDrop / priceStats.previousPrice) * 100);
            } else if (priceStats.totalPricePoints >= 2 && priceStats.averagePrice > livePrice) {
              genuinePrevPrice = priceStats.averagePrice;
              genuineCashDrop = priceStats.averagePrice - livePrice;
              genuineDiscountPct = Math.round((genuineCashDrop / priceStats.averagePrice) * 100);
            }

            if (genuineDiscountPct >= 5 && genuinePrevPrice > livePrice) {
              const thresholdCheck = meetsCategoryThreshold(
                prod.category || 'general',
                prod.subcategory || '',
                genuineDiscountPct,
                genuineCashDrop,
                'IN'
              );

              if (thresholdCheck.qualifies) {
                // Check if deal already exists
                let existingDeal = await Deal.findOne({
                  productId: prod.productId,
                  country: 'IN',
                  isExpired: { $ne: true }
                });
                if (!existingDeal) {
                  existingDeal = await Deal.findOne({
                    $or: [
                      { productId: prod.productId, country: 'IN' },
                      { dealUrl: prod.cleanUrl, country: 'IN' }
                    ]
                  }).sort({ createdAt: -1 });
                }

                if (existingDeal) {
                  existingDeal.dealPrice = livePrice;
                  existingDeal.previousPrice = genuinePrevPrice;
                  existingDeal.originalPrice = prod.originalPrice || existingDeal.originalPrice;
                  existingDeal.discountPercentage = genuineDiscountPct;
                  existingDeal.hasPriceHistory = true;
                  existingDeal.isVerified = true;
                  existingDeal.isExpired = false;
                  existingDeal.lastVerifiedAt = now;
                  await existingDeal.save();
                  await Deal.updateMany(
                    { productId: prod.productId, country: 'IN', _id: { $ne: existingDeal._id }, isExpired: { $ne: true } },
                    { $set: { isExpired: true, expiredAt: now, expiryReason: 'superseded_by_backfiller' } }
                  ).catch(() => {});
                } else {
                  const newDeal = new Deal({
                    sourceChannelId: 'catalog_engine',
                    sourceMessageId: `catalog_${prod.productId}_${Date.now()}`,
                    sourceChannelName: 'ShoppersDeals Price Drop Engine',
                    sourceEngine: 'engine2',
                    hasPriceHistory: true,
                    originalText: `Genuine Price Drop: ${prod.title} at ₹${livePrice} (Dropped from ₹${genuinePrevPrice})`,
                    title: prod.title,
                    description: `Live price drop verified against 90-day history. Dropped from ₹${genuinePrevPrice} to ₹${livePrice} (${genuineDiscountPct}% real drop).`,
                    imageUrl: prod.imageUrl || (prod.images && prod.images[0]) || null,
                    images: prod.images || (prod.imageUrl ? [prod.imageUrl] : []),
                    rating: prod.rating || 4.2,
                    dealUrl: prod.cleanUrl,
                    productId: prod.productId,
                    merchant: prod.merchant || 'amazon',
                    country: 'IN',
                    originalPrice: prod.originalPrice,
                    dealPrice: livePrice,
                    previousPrice: genuinePrevPrice,
                    discountPercentage: genuineDiscountPct,
                    priceSource: 'price_history',
                    category: prod.category || 'general',
                    subcategory: prod.subcategory || '',
                    isVerified: true,
                    isExpired: false,
                    lastVerifiedAt: now,
                    createdAt: now,
                    updatedAt: now
                  });
                  await newDeal.save();
                  await Deal.updateMany(
                    { productId: prod.productId, country: 'IN', _id: { $ne: newDeal._id }, isExpired: { $ne: true } },
                    { $set: { isExpired: true, expiredAt: now, expiryReason: 'superseded_by_backfiller' } }
                  ).catch(() => {});
                  stats.dealsSynthesized++;
                  console.log(`[PriceHistory Backfill] 🔥 Synthesized Deal: "${prod.title.slice(0, 40)}" (₹${genuinePrevPrice} ➔ ₹${livePrice}, ${genuineDiscountPct}% off)`);
                }
              }
            } else {
              stats.fakeMrpSkipped++;
            }
          } else {
            stats.fakeMrpSkipped++;
          }
        } else {
          stats.notFound++;
        }

        await prod.save();
        // Polite 1.2s delay to prevent any upstream rate limits
        await sleep(1200);
      } catch (prodErr) {
        console.warn(`[PriceHistory Backfill] Error on ${prod.productId}:`, prodErr.message);
        stats.errors++;
        prod.lastBuyhatkeSyncAt = now;
        await prod.save().catch(() => {});
      }
    }

    if (stats.dealsSynthesized > 0) {
      apiCache.invalidatePattern('/api/deals');
    }
    console.log('[PriceHistory Backfill] Batch finished:', stats);
  } catch (err) {
    console.error('[PriceHistory Backfill Critical Error]:', err.message);
  } finally {
    isBackfilling = false;
  }

  return stats;
}

/**
 * Initializes continuous Price History Backfill Scheduler.
 * Runs every 2 minutes processing 15-20 products (~450-600 products/hour).
 */
export function initCatalogPriceHistoryCron() {
  console.log('[PriceHistory Backfill] Initializing continuous price history scheduler (every 2m)...');
  cron.schedule('*/2 * * * *', async () => {
    try {
      await backfillCatalogPriceHistory(15);
    } catch (e) {
      console.error('[PriceHistory Backfill Cron Error]:', e);
    }
  });

  // Run initial small batch 15s after startup
  setTimeout(() => {
    backfillCatalogPriceHistory(5).catch(() => {});
  }, 15000);
}

export default {
  backfillCatalogPriceHistory,
  initCatalogPriceHistoryCron
};
