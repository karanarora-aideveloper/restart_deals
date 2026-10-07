import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import PriceAlert from '../db/models/priceAlert.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { apiCache } from '../utils/cache.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';

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
 *
 * BUG (fixed): confirmed live — "No matching document found for id ... version 0 ...".
 * A single scrape here (scrapeProductUrl, through the shared distributed queue) can take
 * 90-200s, and the Product document is fetched once at the top of the batch and held in
 * memory for that whole time. If verifier.js or bestsellerCrawler.js touches the SAME
 * product in that window (very plausible — a Telegram post or crawler hit for a product
 * already mid-refresh), this document's version has moved on by the time we .save(), and
 * Mongoose's optimistic-concurrency check rejects the whole write.
 *
 * The previous behavior silently discarded the whole iteration's real work (price update,
 * price-history checkpoint, deal expiry/synthesis) on that rejection, then tried a fallback
 * `product.save()` using the SAME stale in-memory document — which fails with the identical
 * VersionError every time, swallowed by `.catch(() => {})`. Net effect: lastChecked never
 * advanced, so a product contended by two pipelines could keep losing to this race on every
 * subsequent cycle without ever making progress.
 *
 * Fix: on VersionError, re-fetch the current document and replay only OUR modified paths
 * onto it — preserving whatever the concurrent writer changed for paths we didn't touch,
 * rather than blindly overwriting or blindly giving up.
 */
async function saveWithRetry(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err.name !== 'VersionError') throw err;
    const changedPaths = doc.modifiedPaths();
    const fresh = await Product.findById(doc._id);
    if (!fresh) throw err; // deleted out from under us — nothing to retry against
    for (const path of changedPaths) {
      fresh.set(path, doc.get(path));
    }
    await fresh.save();
  }
}

/**
 * Refresh a batch of stale products (lastChecked < 24h ago).
 * Prioritizes products attached to active deals and price alerts.
 * 
 * @param {number} batchSize - Number of products to process in this cycle
 * @returns {Promise<object>} Stats of the batch execution
 */
export async function refreshStaleProductBatch(batchSize = 10) {
  if (isRefreshing) {
    console.log('[Daily Refresher] Previous refresh cycle is still in flight. Skipping this tick.');
    return { skipped: true, reason: 'in_progress' };
  }

  isRefreshing = true;
  const startTime = Date.now();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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

    // 1. TIER 1: User-tracked products and products with active price alerts
    // High-frequency 4-hour monitoring so users get fast price-drop alerts.
    const activeAlertProductIds = await PriceAlert.find({ status: 'active' }).distinct('productId');
    const userMonitoredQuery = {
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
            { lastStoreSyncAt: { $lt: fourHoursAgo } },
            { lastStoreSyncAt: null },
            { lastStoreSyncAt: { $exists: false } },
          ],
        },
      ],
    };

    let staleProducts = await Product.find(userMonitoredQuery)
      .sort({ lastStoreSyncAt: 1 })
      .limit(batchSize);

    const userMonitoredCount = staleProducts.length;

    // 2. TIER 2: Products backing active public deals on the feed (12h cadence)
    if (staleProducts.length < batchSize) {
      const remainingSlots = batchSize - staleProducts.length;
      const existingIds = staleProducts.map((p) => p._id);
      const activeDealProductIds = await Deal.find({ isExpired: { $ne: true } }).distinct('productId');

      const dealMonitoredQuery = {
        _id: { $nin: existingIds },
        productId: { $in: activeDealProductIds },
        $or: [
          { lastStoreSyncAt: { $lt: twelveHoursAgo } },
          { lastStoreSyncAt: null },
          { lastStoreSyncAt: { $exists: false } },
        ],
      };

      const dealProducts = await Product.find(dealMonitoredQuery)
        .sort({ lastStoreSyncAt: 1 })
        .limit(remainingSlots);

      staleProducts = staleProducts.concat(dealProducts);
    }

    // 3. TIER 3: General catalog items (standard 24h rolling cadence)
    if (staleProducts.length < batchSize) {
      const remainingSlots = batchSize - staleProducts.length;
      const existingIds = staleProducts.map((p) => p._id);

      const generalCatalogQuery = {
        _id: { $nin: existingIds },
        $or: [
          { lastStoreSyncAt: { $lt: twentyFourHoursAgo } },
          { lastStoreSyncAt: null },
          { lastStoreSyncAt: { $exists: false } },
        ],
      };

      const catalogProducts = await Product.find(generalCatalogQuery)
        .sort({ lastStoreSyncAt: 1 })
        .limit(remainingSlots);

      staleProducts = staleProducts.concat(catalogProducts);
    }

    if (staleProducts.length === 0) {
      console.log('[Daily Refresher] ✓ All catalog products are fresh across all 3 tiers.');
      isRefreshing = false;
      return { skipped: true, reason: 'all_fresh' };
    }

    console.log(`[Daily Refresher] Starting prioritized refresh batch for ${staleProducts.length} product(s) (User-Monitored: ${userMonitoredCount})...`);

    for (const product of staleProducts) {
      stats.processed++;
      const now = new Date();
      const todayStr = getTodayDateString();

      try {
        if (!product.cleanUrl) {
          // Atomic single-field bump, not a full versioned save — nothing else in this
          // branch touched the document, so there's no work to lose to a version conflict
          // and no reason to risk one.
          await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
          continue;
        }

        console.log(`[Daily Refresher] Scraping [${stats.processed}/${staleProducts.length}]: "${product.title || product.productId}" (${product.cleanUrl})...`);
        const scraped = await scrapeProductUrl(product.cleanUrl);

        if (scraped && scraped.price) {
          const livePrice = scraped.price;
          const canonicalMRP = product.originalPrice || scraped.originalPrice || livePrice;
          // Captured BEFORE product.price is overwritten below — this, not MRP or a historical
          // average, is the only base a genuine price-drop deal can be synthesized against (see
          // the deal-synthesis block further down). Read once, up front, precisely so that
          // capture can't accidentally happen after the overwrite.
          const priorTrackedPrice = product.price ?? null;
          const priceChanged = product.price !== livePrice;

          // 2. Normalized Daily Checkpoint Logic
          if (!product.priceHistory) product.priceHistory = [];

          const existingTodayIdx = product.priceHistory.findIndex((h) => {
            if (h.date === todayStr) return true;
            if (h.timestamp) {
              return new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
            }
            return false;
          });

          if (existingTodayIdx >= 0) {
            // Update today's checkpoint with latest price
            product.priceHistory[existingTodayIdx].price = livePrice;
            product.priceHistory[existingTodayIdx].originalPrice = canonicalMRP;
            product.priceHistory[existingTodayIdx].date = todayStr;
            product.priceHistory[existingTodayIdx].timestamp = now;
          } else {
            // Add new daily checkpoint
            product.priceHistory.push({
              date: todayStr,
              price: livePrice,
              originalPrice: canonicalMRP,
              timestamp: now,
            });
          }

          // Keep price history sorted chronologically
          product.priceHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          if (product.priceHistory.length > 90) {
            product.priceHistory = product.priceHistory.slice(-90);
          }

          if (priceChanged) {
            console.log(`[Daily Refresher] 📈 Price Update for "${product.title}": ₹${product.price} ➔ ₹${livePrice}`);
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
              // Price increased above deal price -> Deal is EXPIRED
              if (!deal.isExpired) {
                deal.isExpired = true;
                deal.expiredAt = now;
                deal.lastVerifiedAt = now;
                await deal.save();
                stats.dealsExpired++;
                console.log(`[Daily Refresher] ❌ Deal EXPIRED: "${deal.title}" (Live: ₹${livePrice} > Deal: ₹${deal.dealPrice})`);
              }
            } else if (deal.dealPrice && livePrice <= deal.dealPrice) {
              // Deal is STILL VALID
              let dealUpdated = false;
              if (deal.isExpired) {
                deal.isExpired = false;
                deal.expiredAt = null;
                dealUpdated = true;
              }
              deal.lastVerifiedAt = now;
              // If price dropped even lower, update deal price. discountPercentage is
              // recomputed against the deal's OWN previous price, same rule as everywhere
              // else in this pipeline — not canonicalMRP, which would silently switch an
              // existing price-history-qualified deal over to an MRP-based percentage the
              // moment it happened to drop again.
              if (livePrice < deal.dealPrice) {
                const priorDealPrice = deal.dealPrice;
                deal.dealPrice = livePrice;
                deal.discountPercentage = Math.round(((priorDealPrice - livePrice) / priorDealPrice) * 100);
                deal.previousPrice = priorDealPrice;
                deal.priceSource = 'price_history';
                dealUpdated = true;
                console.log(`[Daily Refresher] 🔥 Deal Price Dropped Further: "${deal.title}" ➔ ₹${livePrice}`);

                // Re-enqueue deal for broadcasting the new lower price
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
            const thresholdCheck = meetsCategoryThreshold(product.category, product.subcategory, genuineDiscount, cashDrop);

            if (thresholdCheck.qualifies) {
              const synthesizedDeal = new Deal({
                sourceChannelId: 'catalog_engine',
                sourceMessageId: `${product.productId}_${Date.now()}`,
                sourceChannelName: 'ShoppersDeals Price Drop Engine',
                originalText: `Autonomous Price Drop Detected: ${product.title} at ₹${livePrice}`,
                title: product.title,
                description: `Live price drop detected on ${product.merchant || 'Amazon'}. Price fell from ₹${priorTrackedPrice} to ₹${livePrice}.`,
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

              // Route deal to universal outbound publish queue (Telegram, Twitter, WhatsApp)
              await enqueueDealForPublishing(synthesizedDeal._id, { sourceEngine: 'catalog_refresher' });
            }
          }

          // 4. Evaluate User Price Alerts (Unconditional — triggers whenever livePrice <= targetPrice)
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
          // Scrape failed or product unreachable, mark lastChecked so we move on to next —
          // atomic, same reasoning as the no-cleanUrl branch above.
          await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
        }

        // Pacing delay between product requests (1 second) to be gentle on servers & proxies
        await new Promise((r) => setTimeout(r, 1000));
      } catch (prodErr) {
        console.error(`[Daily Refresher Error] Failed for product ${product.productId}:`, prodErr.message);
        stats.errors++;
        // Atomic, not a re-save of the stale in-memory doc — the previous version's fallback
        // re-tried .save() on the exact same object that just failed (often from a
        // VersionError, see saveWithRetry()'s docblock above), which fails identically every
        // time and was silently swallowed, leaving lastChecked stuck and this product
        // eligible for immediate re-selection next cycle regardless of what actually failed.
        await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } }).catch(() => {});
      }
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

  const totalProducts = await Product.countDocuments();
  const refreshedLast24h = await Product.countDocuments({ lastChecked: { $gte: twentyFourHoursAgo } });
  const pendingRefresh = totalProducts - refreshedLast24h;

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
 * Flash sale deals on Amazon/Flipkart rarely last beyond 24-72 hours.
 * Sweeps the collection periodically to keep active deals fresh and accurate.
 *
 * @param {number} maxAgeDays - Age threshold in days after which un-verified deals expire (default: 5)
 * @returns {Promise<number>} Number of deals expired
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
 * Runs every 3 minutes to process a batch of 10 stale products (200/hour, ~4,800 products/day).
 * Sweeps and auto-expires stale deals hourly.
 */
export function startDailyProductRefresher() {
  console.log('[Daily Refresher] Initializing 24-Hour Product Refresh Cron Schedule (Every 3 minutes)...');

  // Run every 3 minutes: '*/3 * * * *'
  cron.schedule('*/3 * * * *', async () => {
    try {
      await refreshStaleProductBatch(10);
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

  // Run initial small batch and stale deal expiry after 15 seconds on startup
  setTimeout(() => {
    refreshStaleProductBatch(5).catch(() => {});
    autoExpireStaleDeals(5).catch(() => {});
  }, 15000);
}
