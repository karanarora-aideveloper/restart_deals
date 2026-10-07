import cron from 'node-cron';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { PRIORITY } from '../services/scraperQueue.js';
import { apiCache } from '../utils/cache.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';

let isWatcherRunning = false;

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Engine 2: Top-20 Catalog Price Watcher Batch Runner
 *
 * Guarantees a strict 12-hour sync cadence for the Top 20 products of each subcategory.
 * Paced throughput: 5 products every 3 minutes = ~100 products/hour = easily covers 800 products in 8-12 hours.
 *
 * @param {number} batchSize - Number of Top-20 products to check in this tick (default: 5)
 * @returns {Promise<object>} Batch execution statistics
 */
export async function syncTop20Batch(batchSize = 5) {
  if (isWatcherRunning) {
    console.log('[Top20 Watcher] Previous cycle still in flight. Skipping tick.');
    return { skipped: true, reason: 'in_progress' };
  }

  isWatcherRunning = true;
  const startTime = Date.now();
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const todayDateStr = getTodayDateString();

  const stats = {
    processed: 0,
    priceUpdated: 0,
    dealsSynthesized: 0,
    dealsExpired: 0,
    errors: 0,
  };

  try {
    // 1. Query Top-20 products needing sync (lastStoreSyncAt is older than 12h or null)
    // India-only for now; Engine 2 US catalog watcher expansion deferred to future phase
    const productsToSync = await Product.find({
      isTop20: true,
      $or: [
        { country: 'IN' },
        { country: { $exists: false } },
        { country: null }
      ],
      $and: [
        {
          $or: [
            { lastChecked: { $lt: twelveHoursAgo } },
            { lastChecked: null },
            { lastChecked: { $exists: false } }
          ]
        }
      ]
    })
      .sort({ lastChecked: 1 })
      .limit(batchSize);

    if (productsToSync.length === 0) {
      console.log('[Top20 Watcher] ✓ All Top-20 catalog products are completely fresh (synced within last 12h).');
      isWatcherRunning = false;
      return { skipped: true, reason: 'all_fresh' };
    }

    console.log(`[Top20 Watcher] 🎯 Starting Engine 2 sync batch for ${productsToSync.length} Top-20 product(s)...`);

    for (const product of productsToSync) {
      stats.processed++;
      const now = new Date();
      const priorTrackedPrice = product.price != null ? product.price : null;

      try {
        if (!product.cleanUrl) {
          await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
          continue;
        }

        console.log(`[Top20 Watcher] 🔍 Scraping Top-20 item: "${product.title || product.productId}" (${product.merchant}, Rank: #${product.top20Rank || 'N/A'})...`);

        // Execute live store scrape with CATALOG_TOP20 priority
        const scraped = await scrapeProductUrl(product.cleanUrl, PRIORITY.CATALOG_TOP20);

        if (scraped && (scraped.price != null || scraped.isOutOfStock)) {
          const livePrice = scraped.price;
          const canonicalMRP = scraped.originalPrice || product.originalPrice || null;

          // Handle Out-of-Stock
          if (scraped.isOutOfStock || livePrice == null) {
            console.log(`[Top20 Watcher] ⚠️ Product out of stock on store: "${product.title}"`);
            product.isAvailable = false;
            product.lastStoreSyncAt = now;
            product.lastChecked = now;
            await product.save();

            // Expire any active deal
            await Deal.updateMany(
              { productId: product.productId, isExpired: false },
              { $set: { isExpired: true, expiredAt: now, lastVerifiedAt: now } }
            );
            continue;
          }

          product.isAvailable = true;

          // 2. Normalized Daily Checkpoint in priceHistory (1 checkpoint per calendar day)
          if (!Array.isArray(product.priceHistory)) {
            product.priceHistory = [];
          }

          const existingDayIndex = product.priceHistory.findIndex(entry => entry.date === todayDateStr);
          if (existingDayIndex >= 0) {
            // If price changed today, record the lower price of the day
            if (livePrice < product.priceHistory[existingDayIndex].price) {
              product.priceHistory[existingDayIndex].price = livePrice;
              product.priceHistory[existingDayIndex].timestamp = now;
            }
          } else {
            product.priceHistory.push({
              date: todayDateStr,
              price: livePrice,
              originalPrice: canonicalMRP,
              timestamp: now,
            });
          }

          // Keep 90-day rolling compaction to protect database document size
          if (product.priceHistory.length > 90) {
            product.priceHistory = product.priceHistory.slice(-90);
          }

          const priceChanged = priorTrackedPrice != null && priorTrackedPrice !== livePrice;
          if (priceChanged) {
            console.log(`[Top20 Watcher] 📊 Price Change for "${product.title}": ₹${priorTrackedPrice} ➔ ₹${livePrice}`);
            product.previousPrice = priorTrackedPrice;
            product.price = livePrice;
            product.priceUpdatedAt = now;
            stats.priceUpdated++;
          } else if (product.price == null) {
            product.price = livePrice;
          }

          if (canonicalMRP) product.originalPrice = canonicalMRP;
          if (scraped.title && (!product.title || product.title === 'Product Item')) product.title = scraped.title;
          if (scraped.brand) product.brand = scraped.brand;
          if (scraped.images && scraped.images.length > 0) product.images = scraped.images;
          if (scraped.rating) product.rating = scraped.rating;

          product.hasPriceHistory = Boolean(product.priceHistory && product.priceHistory.length >= 2);
          product.lastStoreSyncAt = now;
          product.lastChecked = now;
          product.updatedAt = now;
          await product.save();

          // 3. Evaluate Attached Deals
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
                await deal.save();
                stats.dealsExpired++;
                console.log(`[Top20 Watcher] ❌ Deal Expired: "${deal.title}" (Live: ₹${livePrice} > Deal: ₹${deal.dealPrice})`);
              }
            } else if (deal.dealPrice && livePrice <= deal.dealPrice) {
              if (deal.isExpired) {
                deal.isExpired = false;
                deal.expiredAt = null;
              }
              deal.lastVerifiedAt = now;

              // Price dropped even further
              if (livePrice < deal.dealPrice) {
                const priorDealPrice = deal.dealPrice;
                deal.dealPrice = livePrice;
                deal.discountPercentage = Math.round(((priorDealPrice - livePrice) / priorDealPrice) * 100);
                deal.previousPrice = priorDealPrice;
                deal.priceSource = 'price_history';
                console.log(`[Top20 Watcher] 🔥 Deal Price Dropped Further: "${deal.title}" ➔ ₹${livePrice}`);
                // Re-enqueue deal to announce the new lower price
                enqueueDealForPublishing(deal._id, { sourceEngine: 'engine2_catalog_top20' }).catch(() => {});
              }
              await deal.save();
            }
          }

          // 4. Autonomous Deal Synthesis for Engine 2
          if (matchingDeals.length === 0 && product.title && product.cleanUrl && priorTrackedPrice != null && priorTrackedPrice > livePrice) {
            const genuineDiscount = Math.round(((priorTrackedPrice - livePrice) / priorTrackedPrice) * 100);
            const cashDrop = priorTrackedPrice - livePrice;
            const thresholdCheck = meetsCategoryThreshold(product.category, product.subcategory, genuineDiscount, cashDrop, product.country || 'IN');

            if (thresholdCheck.qualifies) {
              const synthesizedDeal = new Deal({
                sourceChannelId: 'catalog_top20_engine',
                sourceMessageId: `top20_${product.productId}_${Date.now()}`,
                sourceChannelName: 'Top-20 Catalog Price Watcher',
                sourceEngine: 'engine2',
                hasPriceHistory: Boolean(product.hasPriceHistory || (product.priceHistory && product.priceHistory.length >= 2)),
                originalText: `Autonomous Price Drop Detected on Top-20 ${product.top20Subcategory || 'Catalog'}: ${product.title} at ₹${livePrice}`,
                title: product.title,
                description: `Autonomous price drop detected on Top-20 product (${product.merchant || 'Amazon'}). Price fell from ₹${priorTrackedPrice} to ₹${livePrice}.`,
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
              stats.dealsSynthesized++;
              console.log(`[Top20 Watcher] 🚀 AUTONOMOUS DEAL CREATED: "${synthesizedDeal.title}" — ${thresholdCheck.reason}`);
              apiCache.invalidatePattern('/api/deals');

              // Enqueue deal to universal outbound publish queue (Telegram, Twitter, WhatsApp)
              await enqueueDealForPublishing(synthesizedDeal._id, { sourceEngine: 'engine2_catalog_top20' });

              // Evaluate personalized user price alerts
              await evaluateAndTriggerPriceAlerts({
                productId: product.productId,
                livePrice,
                title: product.title,
                dealUrl: product.cleanUrl,
                imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
                merchant: product.merchant || 'amazon',
                country: product.country || 'IN',
              });
            }
          }
        } else {
          // Scrape failed, update lastChecked to rotate
          await Product.updateOne({ _id: product._id }, { $set: { lastChecked: now } });
        }

        // 1.5s pacing between products
        await new Promise((r) => setTimeout(r, 1500));
      } catch (prodErr) {
        stats.errors++;
        console.error(`[Top20 Watcher Error] Failed processing "${product.title || product.productId}":`, prodErr.message);
      }
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Top20 Watcher] ✓ Finished batch in ${durationSec}s. Processed: ${stats.processed}, Price Updates: ${stats.priceUpdated}, New Deals: ${stats.dealsSynthesized}, Expired: ${stats.dealsExpired}`);
    return stats;
  } catch (batchErr) {
    console.error('[Top20 Watcher Error] Batch execution failed:', batchErr.message);
    return stats;
  } finally {
    isWatcherRunning = false;
  }
}

/**
 * Start the Engine 2 Top-20 Price Watcher Cron Scheduler
 * Runs every 3 minutes.
 */
export function startTop20PriceWatcherScheduler() {
  console.log('[Top20 Watcher] Initializing Engine 2 scheduler (running every 3 minutes: "*/3 * * * *")...');

  cron.schedule('*/3 * * * *', async () => {
    try {
      await syncTop20Batch(5);
    } catch (err) {
      console.error('[Top20 Watcher Cron Error]:', err.message);
    }
  });

  console.log('[Top20 Watcher] ✓ Engine 2 12-hour Top-20 Price Watcher scheduler is active.');
}
