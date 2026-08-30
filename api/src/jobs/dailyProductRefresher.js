import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import PriceAlert from '../db/models/priceAlert.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { apiCache } from '../utils/cache.js';

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
    // 1. Find stale products sorted by:
    // a) Products with deals (higher priority)
    // b) Products whose lastChecked is oldest
    const staleProducts = await Product.find({
      $or: [
        { lastChecked: { $lt: twentyFourHoursAgo } },
        { lastChecked: null },
        { lastChecked: { $exists: false } }
      ]
    })
      .sort({ lastChecked: 1 })
      .limit(batchSize);

    if (staleProducts.length === 0) {
      console.log('[Daily Refresher] ✓ All catalog products are fresh (checked within last 24h).');
      isRefreshing = false;
      return { skipped: true, reason: 'all_fresh' };
    }

    console.log(`[Daily Refresher] Starting refresh batch for ${staleProducts.length} stale product(s)...`);

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
              }
              await deal.save();
              stats.dealsActive++;
            }
          }

          // 3b. Autonomous Deal Synthesis for Catalog Products without prior deal
          //
          // This is the "later pass" mechanism verifier.js's comments refer to: a product added
          // to the catalog (via Telegram OR the bestseller crawler OR anything else) with no
          // qualifying deal yet becomes one here, once — and only once — a genuine drop against
          // its OWN previously tracked price is actually observed.
          //
          // The three-way OR this replaced used MRP (`canonicalMRP * 0.80`) and a historical
          // average (`priceStats.averagePrice * 0.88`) as alternate qualifying bases, and
          // fabricated a flat 15% "discount" when no MRP existed at all to compute one from. Both
          // MRP and a historical average are exactly the kind of "not a real observed drop" basis
          // ruled out for this pipeline (a page's MRP is routinely inflated by the seller purely
          // to make the discount look bigger) — same rule as verifier.js's price-history path,
          // now applied consistently here too. A brand-new product with no prior tracked price
          // (priorTrackedPrice is null) cannot synthesize a deal on this first check, matching
          // verifier.js exactly — it starts price tracking now and can qualify on a later cycle.
          const PRICE_DROP_MIN_PERCENT = 5;
          if (matchingDeals.length === 0 && product.title && product.cleanUrl && priorTrackedPrice != null && priorTrackedPrice > livePrice) {
            const genuineDiscount = Math.round(((priorTrackedPrice - livePrice) / priorTrackedPrice) * 100);

            if (genuineDiscount >= PRICE_DROP_MIN_PERCENT) {
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
                // Auxiliary display info only, when a real MRP is on file — never what qualified
                // this as a deal or what discountPercentage below is computed from.
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
              console.log(`[Daily Refresher] 🚀 NEW DEAL SYNTHESIZED from Catalog: "${synthesizedDeal.title}" — price-history drop ₹${priorTrackedPrice} -> ₹${livePrice} (${genuineDiscount}% OFF)`);
              apiCache.invalidatePattern('/api/deals');
            }
          }

          // 4. Evaluate User Price Alerts
          const matchingAlerts = await PriceAlert.find({
            productId: product.productId,
            status: 'active'
          });

          for (const alert of matchingAlerts) {
            if (alert.targetPrice && livePrice <= alert.targetPrice) {
              alert.status = 'triggered';
              alert.triggeredAt = now;
              await alert.save();
              stats.alertsTriggered++;
              console.log(`[Daily Refresher] 🔔 Price Alert Triggered for user "${alert.userId || alert.email}"! Target: ₹${alert.targetPrice}, Live: ₹${livePrice}`);
            }
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
 * Start recurring cron job scheduler
 * Runs every 3 minutes to process a batch of 10 stale products (200/hour, ~4,800 products/day).
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

  // Run initial small batch after 15 seconds on startup
  setTimeout(() => {
    refreshStaleProductBatch(5).catch(() => {});
  }, 15000);
}
