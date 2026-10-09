import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import PriceAlert from '../db/models/priceAlert.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { apiCache } from '../utils/cache.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';
import { classifyProduct } from '../utils/categoryClassifier.js';

import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';

let isRefreshing = false;
let lastCycleStats = {
  lastRunAt: null,
  processedCount: 0,
  priceUpdatedCount: 0,
  dealsExpiredCount: 0,
  alertsTriggeredCount: 0,
};

/**
 * Get current date string formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Save a product, retrying once against a freshly-fetched copy on a Mongoose VersionError.
 */
async function saveWithRetry(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err.name !== 'VersionError') throw err;
    const changedPaths = doc.modifiedPaths();
    const fresh = await Product.findById(doc._id);
    if (!fresh) throw err;
    for (const path of changedPaths) {
      fresh.set(path, doc.get(path));
    }
    await fresh.save();
  }
}

/**
 * Process a single product refresh attempt:
 * - Scrapes store page with DAILY_REFRESH priority
 * - If unavailable / 404: marks isAvailable: false, expires active deals
 * - If valid price: updates priceHistory checkpoint, price, rating, MRP
 * - Evaluates deal expiration & price drops (with country support)
 * - Evaluates price alerts
 * - Rotates product forward by stamping lastChecked = now
 */
async function processSingleProduct(product, stats, todayStr) {
  const now = new Date();

  try {
    if (!product.cleanUrl) {
      await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
      return;
    }

    const scraped = await scrapeProductUrl(product.cleanUrl, PRIORITY.DAILY_REFRESH);

    // 1. Check for 404 / Page Not Found / Out of Stock
    const isNotFound = scraped && (
      scraped.isOutOfStock ||
      scraped.title === 'Page Not Found' ||
      (typeof scraped.title === 'string' && scraped.title.toLowerCase().includes('page not found'))
    );

    if (isNotFound) {
      console.log(`[Daily Refresher] ⚠️ Product unavailable or 404 on store: "${product.title || product.productId}"`);
      product.isAvailable = false;
      product.lastStoreSyncAt = now;
      product.lastChecked = now;
      product.updatedAt = now;
      await saveWithRetry(product);

      // Expire any active deals for this product
      const expiredResult = await Deal.updateMany(
        {
          isExpired: { $ne: true },
          $or: [
            { productId: product.productId },
            { dealUrl: product.cleanUrl }
          ]
        },
        {
          $set: {
            isExpired: true,
            expiredAt: now,
            lastVerifiedAt: now,
            expiryReason: 'product_unavailable'
          }
        }
      );
      if (expiredResult.modifiedCount > 0) {
        stats.dealsExpired += expiredResult.modifiedCount;
      }
      return;
    }

    // 2. Valid Price Found
    if (scraped && scraped.price) {
      const livePrice = scraped.price;
      const canonicalMRP = product.originalPrice || scraped.originalPrice || livePrice;
      const priorTrackedPrice = product.price ?? null;
      const priceChanged = product.price !== livePrice;

      // Normalized Daily Checkpoint Logic
      if (!product.priceHistory) product.priceHistory = [];

      const existingTodayIdx = product.priceHistory.findIndex((h) => {
        if (h.date === todayStr) return true;
        if (h.timestamp) {
          return new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
        }
        return false;
      });

      if (existingTodayIdx >= 0) {
        product.priceHistory[existingTodayIdx].price = livePrice;
        product.priceHistory[existingTodayIdx].originalPrice = canonicalMRP;
        product.priceHistory[existingTodayIdx].date = todayStr;
        product.priceHistory[existingTodayIdx].timestamp = now;
      } else {
        product.priceHistory.push({
          date: todayStr,
          price: livePrice,
          originalPrice: canonicalMRP,
          timestamp: now,
        });
      }

      // Keep price history sorted chronologically, max 90 daily checkpoints
      product.priceHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (product.priceHistory.length > 90) {
        product.priceHistory = product.priceHistory.slice(-90);
      }

      if (priceChanged) {
        const currencySymbol = product.country === 'US' ? '$' : '₹';
        console.log(`[Daily Refresher] 📈 Price Update for "${product.title}": ${currencySymbol}${product.price} ➔ ${currencySymbol}${livePrice}`);
        product.price = livePrice;
        product.priceUpdatedAt = now;
        stats.priceUpdated++;
      }

      if (canonicalMRP) product.originalPrice = canonicalMRP;
      if (scraped.title && (!product.title || product.title === 'Product Item')) {
        product.title = scraped.title;
      }
      if (scraped.images && scraped.images.length > 0 && (!product.images || product.images.length === 0)) {
        product.images = scraped.images;
        product.imageUrl = scraped.imageUrl || scraped.images[0];
      }
      if (scraped.rating) product.rating = scraped.rating;

      const effectiveTitle = product.title || scraped.title || '';
      const classified = classifyProduct(effectiveTitle, product.merchant, product.category);
      if (classified && (!product.subcategory || product.category === 'home' || product.category === 'general')) {
        product.category = classified.category;
        product.subcategory = classified.subcategory;
      }

      product.isAvailable = true;
      product.lastStoreSyncAt = now;
      product.lastChecked = now;
      product.updatedAt = now;
      await saveWithRetry(product);

      // 3. Evaluate Attached Deals for Expiration
      const matchingDeals = await Deal.find({
        $or: [
          { productId: product.productId },
          { dealUrl: product.cleanUrl }
        ]
      });

      for (const deal of matchingDeals) {
        if (deal.dealPrice && livePrice > deal.dealPrice) {
          if (!deal.isExpired) {
            deal.isExpired = true;
            deal.expiredAt = now;
            deal.lastVerifiedAt = now;
            deal.expiryReason = 'price_increased';
            await deal.save();
            stats.dealsExpired++;
            console.log(`[Daily Refresher] ❌ Deal EXPIRED: "${deal.title}" (Live: ${livePrice} > Deal: ${deal.dealPrice})`);
          }
        } else if (deal.dealPrice && livePrice <= deal.dealPrice) {
          let dealUpdated = false;
          if (deal.isExpired) {
            deal.isExpired = false;
            deal.expiredAt = null;
            dealUpdated = true;
          }
          deal.lastVerifiedAt = now;
          if (livePrice < deal.dealPrice) {
            const priorDealPrice = deal.dealPrice;
            deal.dealPrice = livePrice;
            deal.discountPercentage = Math.round(((priorDealPrice - livePrice) / priorDealPrice) * 100);
            deal.previousPrice = priorDealPrice;
            deal.priceSource = 'price_history';
            dealUpdated = true;
            console.log(`[Daily Refresher] 🔥 Deal Price Dropped Further: "${deal.title}" ➔ ${livePrice}`);
            enqueueDealForPublishing(deal._id, { sourceEngine: 'price_drop_further' }).catch(() => {});
          }
          await deal.save();
          stats.dealsActive++;
        }
      }

      // 3b. Autonomous Deal Synthesis for Catalog Products without prior deal
      if (matchingDeals.length === 0 && product.title && product.cleanUrl && priorTrackedPrice != null && priorTrackedPrice > livePrice) {
        const genuineDiscount = Math.round(((priorTrackedPrice - livePrice) / priorTrackedPrice) * 100);
        const cashDrop = priorTrackedPrice - livePrice;
        const thresholdCheck = meetsCategoryThreshold(product.category, product.subcategory, genuineDiscount, cashDrop, product.country || 'IN');

        if (thresholdCheck.qualifies) {
          const currencySymbol = product.country === 'US' ? '$' : '₹';
          const synthesizedDeal = new Deal({
            sourceChannelId: 'catalog_engine',
            sourceMessageId: `${product.productId}_${Date.now()}`,
            sourceChannelName: 'ShoppersDeals Price Drop Engine',
            originalText: `Autonomous Price Drop Detected: ${product.title} at ${currencySymbol}${livePrice}`,
            title: product.title,
            description: `Live price drop detected on ${product.merchant || 'Amazon'}. Price fell from ${currencySymbol}${priorTrackedPrice} to ${currencySymbol}${livePrice}.`,
            imageUrl: product.imageUrl || (product.images && product.images[0]) || null,
            images: product.images || (product.imageUrl ? [product.imageUrl] : []),
            rating: product.rating || 4.2,
            dealUrl: product.cleanUrl,
            productId: product.productId,
            merchant: product.merchant || 'amazon',
            originalPrice: canonicalMRP || null,
            dealPrice: livePrice,
            previousPrice: priorTrackedPrice,
            discountPercentage: genuineDiscount,
            priceSource: 'price_history',
            category: product.category || 'general',
            subcategory: product.subcategory || '',
            isVerified: true,
            isExpired: false,
            lastVerifiedAt: now,
            country: product.country || 'IN',
            createdAt: now,
            updatedAt: now,
          });

          await synthesizedDeal.save();
          stats.dealsActive++;
          console.log(`[Daily Refresher] 🚀 NEW DEAL SYNTHESIZED from Catalog: "${synthesizedDeal.title}" — ${thresholdCheck.reason}`);
          apiCache.invalidatePattern('/api/deals');
          await enqueueDealForPublishing(synthesizedDeal._id, { sourceEngine: 'catalog_refresher' });
        }
      }

      // 4. Evaluate User Price Alerts
      const triggeredAlerts = await evaluateAndTriggerPriceAlerts({
        productId: product.productId,
        livePrice,
        title: product.title,
        dealUrl: product.cleanUrl,
        imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
        merchant: product.merchant || 'amazon',
        country: product.country || 'IN',
      });
      if (triggeredAlerts > 0) {
        stats.alertsTriggered += triggeredAlerts;
      }
    } else {
      // Scrape failed or product unreachable, mark lastChecked so we rotate forward
      await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
    }
  } catch (prodErr) {
    console.error(`[Daily Refresher Error] Failed for product ${product.productId}:`, prodErr.message);
    stats.errors++;
    await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } }).catch(() => {});
  }
}

/**
 * Refresh a batch of stale products (lastChecked < 24h ago).
 * Covers 100% of products across Engine 1 (Telegram) and Engine 2 (Catalog/Search).
 * Prioritizes:
 * - Tier 1: User-tracked products and active price alerts (4h cadence)
 * - Tier 2: Products backing active deals on the homepage (12h cadence)
 * - Tier 3: All catalog products across all sources (strict 24h rolling FIFO cadence)
 *
 * @param {number|null} batchSize - Optional batch size override (defaults to dynamic calibration ~20-25)
 * @returns {Promise<object>} Stats of the batch execution
 */
export async function refreshStaleProductBatch(batchSize = null) {
  if (isRefreshing) {
    console.log('[Daily Refresher] Previous refresh cycle is still in flight. Skipping this tick.');
    return { skipped: true, reason: 'in_progress' };
  }

  // Pre-flight check: ensure active ScrapingAnt proxy tokens exist before polling catalog products
  const activeTokens = await ScrapingAntToken.countDocuments({ status: 'active' }).catch(() => 0);
  if (activeTokens === 0) {
    return { skipped: true, reason: 'no_active_tokens' };
  }

  isRefreshing = true;
  const startTime = Date.now();

  const stats = {
    processed: 0,
    priceUpdated: 0,
    dealsExpired: 0,
    dealsActive: 0,
    alertsTriggered: 0,
    errors: 0,
  };

  try {
    const nowTime = Date.now();
    const fourHoursAgo = new Date(nowTime - 4 * 60 * 60 * 1000);
    const twelveHoursAgo = new Date(nowTime - 12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(nowTime - 24 * 60 * 60 * 1000);

    // Compute effective batch size:
    // Sized so that 100% of the active catalog completes within 22-24 hours with safety margin
    let effectiveBatchSize = batchSize;
    if (!effectiveBatchSize) {
      const activeCatalogCount = await Product.countDocuments({ isActive: { $ne: false } }).catch(() => 28650);
      effectiveBatchSize = Math.max(20, Math.ceil(activeCatalogCount / 1320));
    }

    // 1. TIER 1: User-tracked products and products with active price alerts (4-hour cadence)
    const activeAlertProductIds = await PriceAlert.find({ status: 'active' }).distinct('productId');
    const userMonitoredQuery = {
      isActive: { $ne: false },
      $and: [
        {
          $or: [
            { productId: { $in: activeAlertProductIds } },
            { isTrackedByUsers: true },
            { isTrackedByExtension: true },
            { 'extensionUsers.0': { $exists: true } },
          ],
        },
        {
          $or: [
            { lastChecked: { $lt: fourHoursAgo } },
            { lastChecked: null },
            { lastChecked: { $exists: false } },
          ],
        },
      ],
    };

    let staleProducts = await Product.find(userMonitoredQuery)
      .sort({ lastChecked: 1 })
      .limit(effectiveBatchSize);

    const userMonitoredCount = staleProducts.length;

    // 2. TIER 2: Products backing active public deals on the feed (12h cadence)
    if (staleProducts.length < effectiveBatchSize) {
      const remainingSlots = effectiveBatchSize - staleProducts.length;
      const existingIds = staleProducts.map((p) => p._id);
      const activeDealProductIds = await Deal.find({ isExpired: { $ne: true } }).distinct('productId');

      const dealMonitoredQuery = {
        isActive: { $ne: false },
        _id: { $nin: existingIds },
        productId: { $in: activeDealProductIds },
        $or: [
          { lastChecked: { $lt: twelveHoursAgo } },
          { lastChecked: null },
          { lastChecked: { $exists: false } },
        ],
      };

      const dealProducts = await Product.find(dealMonitoredQuery)
        .sort({ lastChecked: 1 })
        .limit(remainingSlots);

      staleProducts = staleProducts.concat(dealProducts);
    }

    // 3. TIER 3: General catalog items across Engine 1 + Engine 2 (strict 24h rolling FIFO cadence)
    if (staleProducts.length < effectiveBatchSize) {
      const remainingSlots = effectiveBatchSize - staleProducts.length;
      const existingIds = staleProducts.map((p) => p._id);

      const generalCatalogQuery = {
        isActive: { $ne: false },
        _id: { $nin: existingIds },
        $or: [
          { lastChecked: { $lt: twentyFourHoursAgo } },
          { lastChecked: null },
          { lastChecked: { $exists: false } },
        ],
      };

      const catalogProducts = await Product.find(generalCatalogQuery)
        .sort({ lastChecked: 1 })
        .limit(remainingSlots);

      staleProducts = staleProducts.concat(catalogProducts);
    }

    if (staleProducts.length === 0) {
      console.log('[Daily Refresher] ✓ All catalog products are fresh across all 3 tiers.');
      isRefreshing = false;
      return { skipped: true, reason: 'all_fresh' };
    }

    const todayStr = getTodayDateString();
    console.log(`[Daily Refresher] ⚡ Starting 24h refresh batch for ${staleProducts.length} product(s) (User-Monitored: ${userMonitoredCount}, Target Cadence: 24h)...`);

    // Process with bounded parallel concurrency (4 concurrent worker slots)
    const CONCURRENCY = parseInt(process.env.DAILY_REFRESH_CONCURRENCY || '4', 10);
    for (let i = 0; i < staleProducts.length; i += CONCURRENCY) {
      const chunk = staleProducts.slice(i, i + CONCURRENCY);
      await Promise.allSettled(chunk.map((product) => {
        stats.processed++;
        return processSingleProduct(product, stats, todayStr);
      }));
    }

  } catch (err) {
    console.error('[Daily Refresher Critical Error]:', err.message);
  } finally {
    isRefreshing = false;
    lastCycleStats = {
      lastRunAt: new Date(),
      durationMs: Date.now() - startTime,
      ...stats
    };
    console.log(`[Daily Refresher] Batch finished in ${((Date.now() - startTime) / 1000).toFixed(1)}s: ${stats.processed} processed, ${stats.priceUpdated} prices updated, ${stats.dealsExpired} deals expired, ${stats.alertsTriggered} alerts triggered.`);
  }

  return lastCycleStats;
}

/**
 * Get refresh status & metrics for Admin Dashboard
 */
export async function getRefresherStatus() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const totalProducts = await Product.countDocuments({ isActive: { $ne: false } });
  const refreshedLast24h = await Product.countDocuments({
    isActive: { $ne: false },
    lastChecked: { $gte: twentyFourHoursAgo }
  });
  const pendingRefresh = Math.max(0, totalProducts - refreshedLast24h);

  const totalDeals = await Deal.countDocuments();
  const activeDeals = await Deal.countDocuments({ isExpired: false });
  const expiredDeals = await Deal.countDocuments({ isExpired: true });

  const activeAlerts = await PriceAlert.countDocuments({ status: 'active' });
  const triggeredAlerts = await PriceAlert.countDocuments({ status: 'triggered' });

  return {
    isRefreshing,
    totalProducts,
    refreshedLast24h,
    pendingRefresh,
    freshnessPercentage: totalProducts > 0 ? Math.round((refreshedLast24h / totalProducts) * 100) : 100,
    deals: {
      total: totalDeals,
      active: activeDeals,
      expired: expiredDeals
    },
    alerts: {
      active: activeAlerts,
      triggered: triggeredAlerts
    },
    lastCycle: lastCycleStats
  };
}

/**
 * Auto-expires deals older than maxAgeDays (default: 5 days) that have not been re-verified in the last 48 hours.
 */
export async function autoExpireStaleDeals(maxAgeDays = 5) {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const query = {
      isExpired: { $ne: true },
      createdAt: { $lt: cutoffDate },
      $or: [
        { lastVerifiedAt: { $lt: fortyEightHoursAgo } },
        { lastVerifiedAt: null },
        { lastVerifiedAt: { $exists: false } }
      ]
    };

    const count = await Deal.countDocuments(query);
    if (count > 0) {
      const result = await Deal.updateMany(query, {
        $set: {
          isExpired: true,
          expiredAt: new Date(),
          expiryReason: 'stale_timeout'
        }
      });
      console.log(`[Deal Lifecycle] 🧹 Auto-expired ${result.modifiedCount} stale deals (older than ${maxAgeDays} days without recent re-verification).`);
      apiCache.invalidatePattern('/api/deals');
      return result.modifiedCount;
    }
    return 0;
  } catch (err) {
    console.error('[Deal Lifecycle Error] Failed to auto-expire stale deals:', err.message);
    return 0;
  }
}

/**
 * Start recurring cron job scheduler
 * Runs every 1 minute to process a batch of ~20-25 stale products (1,200-1,500/hour, ~28,800-36,000 products/day).
 * Sweeps and auto-expires stale deals hourly.
 */
export function startDailyProductRefresher() {
  console.log('[Daily Refresher] Initializing 24-Hour Product Refresh Cron Schedule (Every 1 minute: "* * * * *")...');

  // Run every 1 minute: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      await refreshStaleProductBatch();
    } catch (err) {
      console.error('[Daily Refresher Cron Error]:', err.message);
    }
  });

  // Run auto-expiry sweep every hour at minute 0: '0 * * * *'
  cron.schedule('0 * * * *', async () => {
    try {
      await autoExpireStaleDeals(5);
    } catch (err) {
      console.error('[Deal Expiry Cron Error]:', err.message);
    }
  });

  // Run initial small batch and stale deal expiry after 10 seconds on startup
  setTimeout(() => {
    refreshStaleProductBatch(5).catch(() => {});
    autoExpireStaleDeals(5).catch(() => {});
  }, 10000);
}
