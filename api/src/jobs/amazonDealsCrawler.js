import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { fetchBuyhatkePriceHistory } from '../services/buyhatkeService.js';
import { classifyProduct } from '../utils/categoryClassifier.js';
import { apiCache } from '../utils/cache.js';
import { computePriceStats } from '../utils/priceAnalytics.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

let isCrawling = false;

function parseNumericPrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/₹|,|\s/g, '').trim();
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

function parseTimeRemainingMs(endsInText) {
  if (!endsInText) return null;
  const m = endsInText.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let hours = 0, mins = 0, secs = 0;
  if (m[3] !== undefined) {
    hours = parseInt(m[1], 10);
    mins = parseInt(m[2], 10);
    secs = parseInt(m[3], 10);
  } else {
    mins = parseInt(m[1], 10);
    secs = parseInt(m[2], 10);
  }
  return (hours * 3600 + mins * 60 + secs) * 1000;
}

/**
 * Crawls https://www.amazon.in/deals, extracts all deal products,
 * enriches them with Buyhatke price history, upserts to Product & Deal collections.
 * 
 * @param {Object} options
 * @param {number} [options.maxDeals=100] Maximum deals to process
 * @param {boolean} [options.fetchBuyhatke=true] Whether to copy price history from Buyhatke
 */
export async function syncAmazonDeals(options = {}) {
  const { maxDeals = 100, fetchBuyhatke = true } = options;

  if (isCrawling) {
    console.log('[Amazon Deals Crawler] Already running. Skipping duplicate sweep.');
    return { status: 'already_running' };
  }

  isCrawling = true;
  const stats = {
    totalFound: 0,
    productsEnrolled: 0,
    productsUpdated: 0,
    priceHistoryBackfilled: 0,
    dealsCreated: 0,
    dealsUpdated: 0,
    errors: 0
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  try {
    const dealsUrl = 'https://www.amazon.in/deals';
    console.log(`[Amazon Deals Crawler] Fetching ${dealsUrl} via scraperQueue...`);
    const html = await scraperQueue.enqueue(dealsUrl, { priority: PRIORITY.BESTSELLER, render_js: true });

    if (!html) {
      console.error('[Amazon Deals Crawler] Failed to retrieve HTML from amazon.in/deals');
      return stats;
    }

    const $ = cheerio.load(html);
    const discoveredAsins = new Set();
    const dealCards = [];

    // Find all ASIN containers on the deals page
    $('[data-asin], a[href*="/dp/"]').each((_, el) => {
      let asin = $(el).attr('data-asin');
      const href = $(el).attr('href') || '';
      if (!asin || asin.length !== 10) {
        const m = href.match(/\/dp\/([A-Z0-9]{10})/i);
        if (m) asin = m[1].toUpperCase();
      }

      if (!asin || asin.length !== 10 || discoveredAsins.has(asin)) return;
      discoveredAsins.add(asin);

      // Extract card container
      const container = $(el).is('a') 
        ? $(el).parents('[data-testid], [class*="Card"], [class*="Item"], [class*="deal"], li, div').eq(2)
        : $(el);

      const text = container.text().replace(/\s+/g, ' ').trim();
      const imgEl = container.find('img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
      let rawTitle = imgEl.attr('alt') || container.find('h2, [class*="title"], [class*="truncate"]').first().text().trim();

      // Clean title
      if (!rawTitle || rawTitle.length < 5) {
        rawTitle = container.find('a[href*="/dp/"]').first().text().trim();
      }

      // Extract prices
      let dealPrice = null;
      let originalPrice = null;
      let discountPct = null;

      // Match "Deal Price: ₹229.00" or ".a-price-whole"
      const dealPriceMatch = text.match(/Deal Price:\s*₹?([\d,]+(?:\.\d{2})?)/i) ||
                             text.match(/₹([\d,]+(?:\.\d{2})?)/i);
      if (dealPriceMatch) {
        dealPrice = parseNumericPrice(dealPriceMatch[1]);
      }

      // Match "M.R.P: M.R.P: ₹309.00"
      const mrpMatch = text.match(/M\.R\.P[:\s]*₹?([\d,]+(?:\.\d{2})?)/i);
      if (mrpMatch) {
        originalPrice = parseNumericPrice(mrpMatch[1]);
      }

      // Match "26% off"
      const discMatch = text.match(/(\d{1,2})%\s*off/i);
      if (discMatch) {
        discountPct = parseInt(discMatch[1], 10);
      } else if (originalPrice && dealPrice && originalPrice > dealPrice) {
        discountPct = Math.round(((originalPrice - dealPrice) / originalPrice) * 100);
      }

      // Extract Countdown / Lightning deal timer
      let lightningDealEndsAt = null;
      const endsInMatch = text.match(/Ends in\s*([\d:]+)/i);
      if (endsInMatch) {
        const msRemaining = parseTimeRemainingMs(endsInMatch[1]);
        if (msRemaining && msRemaining > 0) {
          lightningDealEndsAt = new Date(Date.now() + msRemaining);
        }
      }

      if (asin && (dealPrice || originalPrice || rawTitle)) {
        dealCards.push({
          asin,
          title: rawTitle || `Amazon Deal Product ${asin}`,
          dealPrice: dealPrice || 999,
          originalPrice: originalPrice || (dealPrice ? Math.round(dealPrice * 1.3) : 1299),
          discountPercentage: discountPct || 15,
          imageUrl,
          cleanUrl: `https://www.amazon.in/dp/${asin}`,
          lightningDealEndsAt
        });
      }
    });

    stats.totalFound = dealCards.length;
    console.log(`[Amazon Deals Crawler] Extracted ${dealCards.length} deals from amazon.in/deals`);

    const itemsToProcess = dealCards.slice(0, maxDeals);

    for (const item of itemsToProcess) {
      try {
        const { asin, title, dealPrice, originalPrice, discountPercentage, imageUrl, cleanUrl, lightningDealEndsAt } = item;
        const classification = classifyProduct(title) || { category: 'home', subcategory: 'decor' };

        let product = await Product.findOne({ productId: asin, country: 'IN' });
        let isNewProduct = false;

        if (!product) {
          isNewProduct = true;
          product = new Product({
            productId: asin,
            country: 'IN',
            merchant: 'amazon',
            title,
            cleanUrl,
            imageUrl,
            images: imageUrl ? [imageUrl] : [],
            price: dealPrice,
            originalPrice,
            previousPrice: originalPrice > dealPrice ? originalPrice : null,
            category: classification.category || 'home',
            subcategory: classification.subcategory || 'decor',
            productSource: 'amazon_deals',
            hasPriceHistory: false,
            priceHistory: [{ date: todayStr, price: dealPrice, originalPrice, timestamp: now }],
            lastStoreSyncAt: now,
            lastChecked: now,
            priceUpdatedAt: now,
            createdAt: now,
            updatedAt: now
          });
        } else {
          // Existing product update
          if (title && (!product.title || product.title.length < 10)) product.title = title;
          if (imageUrl && !product.imageUrl) product.imageUrl = imageUrl;
          if (originalPrice && (!product.originalPrice || product.originalPrice < originalPrice)) {
            product.originalPrice = originalPrice;
          }
          if (product.price && product.price !== dealPrice) {
            product.previousPrice = product.price;
          }
          product.price = dealPrice;
          product.lastStoreSyncAt = now;
          product.lastChecked = now;
          product.priceUpdatedAt = now;
          product.updatedAt = now;
        }

        // Backfill price history from Buyhatke if missing
        const needsBuyhatkeHistory = fetchBuyhatke && (!product.hasPriceHistory || !product.priceHistory || product.priceHistory.length < 2);

        if (needsBuyhatkeHistory) {
          console.log(`[Amazon Deals Crawler] Fetching Buyhatke history for ${asin} ("${title.slice(0, 30)}...")...`);
          const buyhatkeCheckpoints = await fetchBuyhatkePriceHistory(asin, title, 'amazon', dealPrice, originalPrice);
          if (buyhatkeCheckpoints && buyhatkeCheckpoints.length >= 30) {
            product.priceHistory = buyhatkeCheckpoints;
            product.hasPriceHistory = true;
            product.lastBuyhatkeSyncAt = now;
            stats.priceHistoryBackfilled++;
            console.log(`[Amazon Deals Crawler]  ✓ Successfully hydrated ${buyhatkeCheckpoints.length} price checkpoints from Buyhatke for ${asin}!`);
          } else {
            // Keep at least 1 checkpoint
            if (!Array.isArray(product.priceHistory) || product.priceHistory.length === 0) {
              product.priceHistory = [{ date: todayStr, price: dealPrice, originalPrice, timestamp: now }];
            }
            product.hasPriceHistory = Boolean(product.priceHistory && product.priceHistory.length >= 2);
          }
        } else {
          // Check existing history
          product.hasPriceHistory = Boolean(product.priceHistory && product.priceHistory.length >= 2);
        }

        await product.save();
        if (isNewProduct) stats.productsEnrolled++;
        else stats.productsUpdated++;

        // ─── STRICT ZERO-MRP DEAL VERIFICATION ───────────────────────────
        // Never trust retailer's claimed MRP or banner discounts.
        // A genuine deal requires a real price reduction against tracked historical prices.
        const priceStats = computePriceStats(product);

        // Check if price is genuinely lower than previous selling price or historical average
        let genuinePrevPrice = null;
        let genuineDiscountPct = 0;
        let genuineCashDrop = 0;

        if (priceStats && priceStats.previousPrice && priceStats.previousPrice > dealPrice) {
          genuinePrevPrice = priceStats.previousPrice;
          genuineCashDrop = priceStats.previousPrice - dealPrice;
          genuineDiscountPct = Math.round((genuineCashDrop / priceStats.previousPrice) * 100);
        } else if (priceStats && priceStats.totalPricePoints >= 2 && priceStats.averagePrice > dealPrice) {
          genuinePrevPrice = priceStats.averagePrice;
          genuineCashDrop = priceStats.averagePrice - dealPrice;
          genuineDiscountPct = Math.round((genuineCashDrop / priceStats.averagePrice) * 100);
        }

        // Verify with Category Dual Threshold (Drop % or Cash Floor)
        const thresholdCheck = meetsCategoryThreshold(
          product.category || classification.category || 'general',
          product.subcategory || classification.subcategory || '',
          genuineDiscountPct,
          genuineCashDrop,
          'IN'
        );

        const isFakeMrp = Boolean(priceStats?.isFakeMrpDiscount);
        const qualifiesAsDeal = !isFakeMrp && thresholdCheck.qualifies && genuineDiscountPct > 0 && dealPrice > 0;

        if (qualifiesAsDeal) {
          let existingDeal = await Deal.findOne({
            productId: asin,
            country: 'IN',
            isExpired: { $ne: true }
          });
          if (!existingDeal) {
            existingDeal = await Deal.findOne({
              $or: [
                { productId: asin, country: 'IN' },
                { dealUrl: cleanUrl, country: 'IN' }
              ]
            }).sort({ createdAt: -1 });
          }

          if (existingDeal) {
            existingDeal.dealPrice = dealPrice;
            existingDeal.originalPrice = originalPrice || existingDeal.originalPrice;
            existingDeal.discountPercentage = genuineDiscountPct;
            existingDeal.previousPrice = genuinePrevPrice;
            existingDeal.sourceEngine = 'engine2';
            existingDeal.hasPriceHistory = product.hasPriceHistory;
            existingDeal.sourceChannelId = existingDeal.sourceChannelId || 'amazon_deals_engine';
            existingDeal.sourceChannelName = existingDeal.sourceChannelName || 'Amazon Deals Engine';
            existingDeal.isVerified = true;
            existingDeal.isExpired = false;
            existingDeal.lastVerifiedAt = now;
            if (lightningDealEndsAt) existingDeal.lightningDealEndsAt = lightningDealEndsAt;
            await existingDeal.save();
            await Deal.updateMany(
              { productId: asin, country: 'IN', _id: { $ne: existingDeal._id }, isExpired: { $ne: true } },
              { $set: { isExpired: true, expiredAt: now, expiryReason: 'superseded_by_amazon_crawler' } }
            ).catch(() => {});
            stats.dealsUpdated++;
          } else {
            const newDeal = new Deal({
              sourceChannelId: 'amazon_deals_engine',
              sourceMessageId: `amazon_deals_${asin}_${Date.now()}`,
              sourceChannelName: 'Amazon Deals Engine',
              sourceEngine: 'engine2',
              hasPriceHistory: product.hasPriceHistory,
              originalText: `Amazon Price Drop: ${title} at ₹${dealPrice} (Dropped from ₹${genuinePrevPrice})`,
              title,
              description: `Amazon verified price drop. Dropped from ₹${genuinePrevPrice} to ₹${dealPrice} (${genuineDiscountPct}% real drop).`,
              imageUrl: imageUrl || product.imageUrl,
              images: imageUrl ? [imageUrl] : (product.images || []),
              rating: product.rating || 4.2,
              dealUrl: cleanUrl,
              productId: asin,
              merchant: 'amazon',
              country: 'IN',
              originalPrice,
              dealPrice,
              previousPrice: genuinePrevPrice,
              discountPercentage: genuineDiscountPct,
              priceSource: product.hasPriceHistory ? 'price_history' : 'scraped',
              category: classification?.category || (product.category && product.category !== 'home' ? product.category : 'general'),
              subcategory: classification?.subcategory || product.subcategory || '',
              lightningDealEndsAt,
              isVerified: true,
              isExpired: false,
              lastVerifiedAt: now,
              createdAt: now,
              updatedAt: now
            });
            await newDeal.save();
            await Deal.updateMany(
              { productId: asin, country: 'IN', _id: { $ne: newDeal._id }, isExpired: { $ne: true } },
              { $set: { isExpired: true, expiredAt: now, expiryReason: 'superseded_by_amazon_crawler' } }
            ).catch(() => {});
            stats.dealsCreated++;
          }
        } else {
          // If not a genuine drop (e.g. price returned to standard, or fake MRP discount),
          // expire any existing deal for this product
          await Deal.updateMany(
            { productId: asin, isExpired: false },
            { $set: { isExpired: true, expiredAt: now, expiryReason: isFakeMrp ? 'fake_mrp_rejected' : 'price_standard' } }
          );
        }
      } catch (itemErr) {
        console.error(`[Amazon Deals Crawler] Error processing deal ${item.asin}:`, itemErr.message);
        stats.errors++;
      }
    }

    apiCache.invalidatePattern('/api/deals');
    console.log('[Amazon Deals Crawler] Finished run:', stats);
  } finally {
    isCrawling = false;
  }

  return stats;
}

/**
 * Initializes daily Amazon Deals Cron Job.
 * Runs at 04:30 AM IST every day.
 */
export function initAmazonDealsCrawlerCron() {
  console.log('[Amazon Deals Crawler] Initializing Amazon Deals Cron (every 4 hours: 30 */4 * * *)...');
  cron.schedule('30 */4 * * *', async () => {
    console.log('[Amazon Deals Crawler] Running scheduled 4-hour crawl of amazon.in/deals...');
    try {
      await syncAmazonDeals({ maxDeals: 100, fetchBuyhatke: true });
    } catch (e) {
      console.error('[Amazon Deals Crawler] Scheduled crawl failed:', e);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Run initial crawl 25 seconds after server startup
  setTimeout(() => {
    syncAmazonDeals({ maxDeals: 50, fetchBuyhatke: true }).catch(err => {
      console.warn('[Amazon Deals Crawler] Initial startup crawl warning:', err.message);
    });
  }, 25000);
}

// CLI Execution Support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required to run standalone.');
    process.exit(1);
  }
  mongoose.connect(uri)
    .then(async () => {
      console.log('[Amazon Deals Crawler] Connected to MongoDB Atlas.');
      const res = await syncAmazonDeals({ maxDeals: 50, fetchBuyhatke: true });
      console.log('[Amazon Deals Crawler] Result:', res);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default {
  syncAmazonDeals,
  initAmazonDealsCrawlerCron
};
