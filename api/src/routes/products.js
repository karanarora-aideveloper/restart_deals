import express from 'express';
import mongoose from 'mongoose';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import ScrapingLog from '../db/models/scrapingLog.js';
import { computePriceStats } from '../utils/priceAnalytics.js';
import { resolveRedirect, parseProductUrl } from '../utils/urlParser.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { rankCrossStoreMatches, extractBrand, tokenizeTitle, extractModelIdentifiers } from '../utils/vectorMatcher.js';
import { extractVariant, variantsMatch, variantMismatchReason, extractVariantTraits, generateSeriesKey, COLOR_HEX_MAP, getBeautyShadeHex } from '../utils/variantExtractor.js';
import { cacheMiddleware, apiCache } from '../utils/cache.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';
import { autoSeedZeroResultQuery } from '../jobs/bestsellerCrawler.js';

const router = express.Router();

/**
 * GET /api/products
 * Paginated, tokenized multi-field filtered products from MongoDB products collection.
 */
router.get('/', cacheMiddleware(20), async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.merchant && req.query.merchant !== 'all') {
      query.merchant = req.query.merchant.toLowerCase();
    }

    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category.toLowerCase();
    }

    if (req.query.subcategory && req.query.subcategory !== 'all') {
      query.subcategory = req.query.subcategory.toLowerCase();
    }

    if (req.query.country && req.query.country !== 'all') {
      const cCode = req.query.country.toUpperCase();
      if (cCode === 'IN') {
        query.$and = (query.$and || []).concat([{ $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] }]);
      } else {
        query.country = cCode;
      }
    }

    if (req.query.flagged === 'true') {
      query.isFlagged = true;
    } else if (req.query.flagged === 'false') {
      query.$and = (query.$and || []).concat([{ $or: [{ isFlagged: false }, { isFlagged: { $exists: false } }] }]);
    }

    if (req.query.isTop20 === 'true') {
      query.isTop20 = true;
    } else if (req.query.isTop20 === 'false') {
      query.$and = (query.$and || []).concat([{ $or: [{ isTop20: false }, { isTop20: { $exists: false } }] }]);
    }

    if (req.query.productSource && req.query.productSource !== 'all') {
      query.productSource = req.query.productSource;
    }

    if (req.query.trackedByExtension === 'true') {
      query.isTrackedByExtension = true;
    } else if (req.query.trackedByExtension === 'false') {
      query.$and = (query.$and || []).concat([{ $or: [{ isTrackedByExtension: false }, { isTrackedByExtension: { $exists: false } }] }]);
    }

    if (req.query.extensionUserId) {
      query.extensionUsers = req.query.extensionUserId;
    }

    // Deal frequency & count filter (Admin feature: find products with multiple deals)
    if (req.query.dealsFilter && req.query.dealsFilter !== 'all') {
      if (req.query.dealsFilter === 'multiple') {
        const multiDealPids = await Deal.aggregate([
          { $match: { productId: { $exists: true, $ne: null } } },
          { $group: { _id: '$productId', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }
        ]);
        const pids = multiDealPids.map(d => d._id);
        query.productId = { $in: pids };
      } else if (req.query.dealsFilter === 'single') {
        const singleDealPids = await Deal.aggregate([
          { $match: { productId: { $exists: true, $ne: null } } },
          { $group: { _id: '$productId', count: { $sum: 1 } } },
          { $match: { count: 1 } }
        ]);
        const pids = singleDealPids.map(d => d._id);
        query.productId = { $in: pids };
      } else if (req.query.dealsFilter === 'zero') {
        const allDealPids = await Deal.distinct('productId', { productId: { $exists: true, $ne: null } });
        query.productId = { $nin: allDealPids };
      }
    }

    // Price source filter
    if (req.query.priceSource && req.query.priceSource !== 'all') {
      query.priceSource = req.query.priceSource;
    }

    // Minimum rating filter
    if (req.query.minRating && req.query.minRating !== 'all') {
      const minR = parseFloat(req.query.minRating);
      if (!isNaN(minR)) {
        query.rating = { $gte: minR };
      }
    }

    // Minimum discount filter
    if (req.query.minDiscount && req.query.minDiscount !== 'all') {
      const minD = parseInt(req.query.minDiscount, 10);
      if (!isNaN(minD)) {
        query.$expr = {
          $and: [
            { $gt: ['$originalPrice', '$price'] },
            {
              $gte: [
                { $multiply: [{ $divide: [{ $subtract: ['$originalPrice', '$price'] }, '$originalPrice'] }, 100] },
                minD
              ]
            }
          ]
        };
      }
    }

    // Image health filter
    if (req.query.imageStatus === 'missing') {
      query.$and = (query.$and || []).concat([
        { $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }] },
        { $or: [{ images: { $size: 0 } }, { images: { $exists: false } }] }
      ]);
    } else if (req.query.imageStatus === 'has_image') {
      query.$and = (query.$and || []).concat([{
        $or: [
          { imageUrl: { $exists: true, $ne: null, $ne: '' } },
          { 'images.0': { $exists: true } }
        ]
      }]);
    }

    const rawQuery = req.query.q || req.query.search;
    if (rawQuery) {
      const qStr = rawQuery.trim();
      if (qStr.length > 0) {
        const searchTokens = qStr.split(/\s+/).filter(Boolean);
        const andConditions = searchTokens.map(token => {
          const regex = new RegExp(token, 'i');
          return {
            $or: [
              { title: regex },
              { productId: regex },
              { cleanUrl: regex },
              { merchant: regex }
            ]
          };
        });
        query.$and = (query.$and || []).concat(andConditions);
      }
    }

    let sort = { lastChecked: -1 };
    if (req.query.sort) {
      if (req.query.sort === 'price_asc') {
        sort = { price: 1 };
      } else if (req.query.sort === 'price_desc') {
        sort = { price: -1 };
      } else if (req.query.sort === 'rating') {
        sort = { rating: -1 };
      } else if (req.query.sort === 'newest' || req.query.sort === 'created_at' || req.query.sort === 'first_added') {
        sort = { createdAt: -1 };
      } else if (req.query.sort === 'oldest') {
        sort = { createdAt: 1 };
      } else if (req.query.sort === 'recently_checked' || req.query.sort === 'last_scraped') {
        sort = { lastChecked: -1 };
      } else if (req.query.sort === 'least_scraped') {
        sort = { lastChecked: 1 };
      }
    }

    const total = await Product.countDocuments(query);
    if (rawQuery && page === 1 && total === 0) {
      autoSeedZeroResultQuery(rawQuery).catch(() => {});
    }

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Fallback deal images
    const imagelessProducts = products.filter(p => !p.imageUrl && (!p.images || p.images.length === 0));
    let dealImageMap = new Map();
    if (imagelessProducts.length > 0) {
      const deals = await Deal.find({
        $or: imagelessProducts.map(p => ({ productId: p.productId, merchant: p.merchant }))
      }).select('productId merchant imageUrl images').lean();
      dealImageMap = new Map(deals.map(d => [`${d.productId}|${d.merchant}`, d]));
    }

    // Deal counts aggregation for loaded batch
    const productPids = products.map(p => p.productId).filter(Boolean);
    let dealCountMap = new Map();
    if (productPids.length > 0) {
      const dealCounts = await Deal.aggregate([
        { $match: { productId: { $in: productPids } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } }
      ]);
      dealCountMap = new Map(dealCounts.map(d => [d._id, d.count]));
    }

    const data = products.map(p => {
      if (p.imageUrl || (p.images && p.images.length > 0)) return p;
      const fallback = dealImageMap.get(`${p.productId}|${p.merchant}`);
      if (!fallback || (!fallback.imageUrl && (!fallback.images || fallback.images.length === 0))) return p;
      const obj = p.toObject();
      obj.imageUrl = fallback.imageUrl || fallback.images[0];
      obj.images = fallback.images && fallback.images.length > 0 ? fallback.images : [obj.imageUrl];
      obj.imageIsFromDeal = true;
      return obj;
    }).map(p => {
      const obj = p.toObject ? p.toObject() : p;
      const { priceHistory, ...rest } = obj;
      const created = obj.createdAt || (obj._id?.getTimestamp ? obj._id.getTimestamp() : null);
      const lastScraped = obj.lastChecked || obj.updatedAt || obj.priceUpdatedAt;
      return {
        ...rest,
        createdAt: created,
        lastChecked: lastScraped,
        priceHistoryCount: (priceHistory || []).length,
        dealsCount: dealCountMap.get(obj.productId) || 0,
        extensionUsersCount: (obj.extensionUsers || []).length
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[API Error] GET /api/products failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/products/:id/flag
 * Admin-only "this record looks wrong" flag — a human judgment call, separate from the
 * pipeline's own needsEnrichment signal. Body: { flagged: boolean, reason?: string }.
 */
router.patch('/:id/flag', async (req, res) => {
  try {
    const { flagged, reason } = req.body;
    if (typeof flagged !== 'boolean') {
      return res.status(400).json({ success: false, error: '"flagged" (boolean) is required' });
    }

    const update = {
      isFlagged: flagged,
      flagReason: flagged ? (reason || '').trim().slice(0, 500) : '',
      flaggedAt: flagged ? new Date() : null,
    };

    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    } else {
      product = await Product.findOneAndUpdate({ productId: req.params.id }, { $set: update }, { new: true });
    }
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    console.error(`[API Error] PATCH /api/products/${req.params.id}/flag failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Helper to tag product source, anonymous extension user attribution, and tracking metadata.
 */
function applyTrackingAttribution(product, { source, userId, extensionUserId, sourceUrl, extensionVersion, now = new Date() }) {
  const effectiveUserId = (userId || extensionUserId || '').trim() || null;
  const isFromExtension = source === 'extension' || source === 'chrome_extension' || source === 'extension_discovered' || Boolean(effectiveUserId);

  if (isFromExtension) {
    product.isTrackedByExtension = true;
    product.extensionViewsCount = (product.extensionViewsCount || 0) + 1;
    product.lastExtensionViewAt = now;

    if (effectiveUserId) {
      if (!Array.isArray(product.extensionUsers)) {
        product.extensionUsers = [];
      }
      if (!product.extensionUsers.includes(effectiveUserId)) {
        product.extensionUsers.push(effectiveUserId);
      }
    }
  }

  // Populate discoveredBy if missing or empty
  if (!product.discoveredBy || !product.discoveredBy.source) {
    product.discoveredBy = {
      source: isFromExtension ? 'extension' : (source || 'web_user'),
      userId: effectiveUserId,
      sourceUrl: sourceUrl || product.cleanUrl || null,
      extensionVersion: extensionVersion || null,
      discoveredAt: now,
    };
  }

  // If newly discovered via extension, tag productSource
  if (isFromExtension && (!product.productSource || product.productSource === 'telegram')) {
    product.productSource = 'extension';
  }
}

function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Core product ingestion, sync, and crowdsourced price update handler.
 * Used by POST /lookup-url, GET /lookup, and POST /track.
 * Guarantees that live prices discovered via user browser visits travel back to MongoDB Atlas,
 * updates priceHistory (1 normalized checkpoint per calendar day), refreshes lastStoreSyncAt,
 * and tracks user & extension source attribution.
 */
async function handleProductDiscoveryOrSync({
  parsed,
  title,
  price,
  mrp,
  originalPrice,
  imageUrl,
  source = 'extension',
  userId,
  extensionUserId,
  sourceUrl,
  extensionVersion,
}) {
  const now = new Date();
  const todayStr = getTodayDateString();
  const livePrice = Number(price) > 0 ? Math.round(Number(price)) : null;
  const liveMRP = Number(mrp || originalPrice) > 0 ? Math.round(Number(mrp || originalPrice)) : (livePrice || null);
  const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : null;
  const cleanImg = (typeof imageUrl === 'string' && imageUrl.trim()) ? imageUrl.trim() : '';

  let product = await Product.findOne({ cleanUrl: parsed.cleanUrl })
    || await Product.findOne({ productId: parsed.productId, country: parsed.country });
  if (!product && parsed.productId) {
    product = await Product.findOne({ productId: parsed.productId, merchant: parsed.merchant, country: parsed.country });
  }

  // If not in Product collection, check Deal collection for prior seed
  if (!product) {
    const deal = await Deal.findOne({
      $or: [
        { dealUrl: parsed.cleanUrl },
        { productId: parsed.productId, country: parsed.country, merchant: parsed.merchant }
      ]
    }).sort({ createdAt: -1 });
    if (deal) {
      product = new Product({
        productId: parsed.productId,
        cleanUrl: parsed.cleanUrl || deal.dealUrl,
        merchant: parsed.merchant,
        title: deal.title || cleanTitle || 'Product Item',
        imageUrl: deal.imageUrl || (deal.images && deal.images[0]) || cleanImg,
        images: deal.images || (deal.imageUrl ? [deal.imageUrl] : (cleanImg ? [cleanImg] : [])),
        price: deal.dealPrice || deal.originalPrice || livePrice || 0,
        originalPrice: deal.originalPrice || deal.dealPrice || liveMRP || livePrice || 0,
        priceUpdatedAt: deal.createdAt || now,
        priceHistory: [
          {
            price: deal.dealPrice || deal.originalPrice || livePrice || 0,
            originalPrice: deal.originalPrice || deal.dealPrice || liveMRP || livePrice || 0,
            timestamp: deal.createdAt || now,
            date: new Date(deal.createdAt || now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
          }
        ],
        category: (deal.category && deal.category !== 'general') ? deal.category : 'home',
        subcategory: deal.subcategory || 'decor',
        country: parsed.country || deal.country || 'IN',
      });
      await product.save();
    }
  }

  let isNew = false;
  if (!product && parsed.cleanUrl) {
    isNew = true;
    product = new Product({
      productId: parsed.productId,
      cleanUrl: parsed.cleanUrl,
      merchant: parsed.merchant,
      title: cleanTitle || 'Queued for Price Tracking',
      imageUrl: cleanImg,
      images: cleanImg ? [cleanImg] : [],
      price: livePrice || 0,
      originalPrice: liveMRP || livePrice || 0,
      category: 'home',
      subcategory: 'decor',
      country: parsed.country || 'IN',
      priceSource: (source === 'extension' || userId) ? 'extension' : 'user_search',
      priceUpdatedAt: now,
      priceHistory: livePrice ? [{
        price: livePrice,
        originalPrice: liveMRP || livePrice,
        timestamp: now,
        date: todayStr,
      }] : [],
      lastStoreSyncAt: now,
      lastChecked: now,
      isTrackedByUsers: true,
      source: (source === 'extension' || userId) ? 'extension' : 'user_search',
      createdAt: now,
      updatedAt: now,
    });

    applyTrackingAttribution(product, {
      source,
      userId,
      extensionUserId,
      sourceUrl: sourceUrl || parsed.cleanUrl,
      extensionVersion,
      now,
    });

    await product.save();
    console.log(`[API Product Ingest] ✓ Ingested new product from ${source}: "${product.title}" (${product.productId}) - Live price: ₹${livePrice || 0}`);

    // Asynchronously dispatch to BullMQ scraper queue (non-blocking)
    if (scraperQueue && scraperQueue.queue) {
      scraperQueue.queue.add('scrape', {
        url: parsed.cleanUrl,
        source: (source === 'extension' || userId) ? 'extension' : 'user_search',
        enqueuedAt: Date.now(),
      }, { priority: PRIORITY.CATALOG_TOP20 }).catch(err => {
        console.warn('[API Product Ingest] Background queue add warning:', err.message);
      });
    }
  } else if (product) {
    const priorTrackedPrice = product.price || null;
    const priceChanged = livePrice && product.price !== livePrice;

    // Apply live price from client DOM
    if (livePrice) {
      product.price = livePrice;
      if (liveMRP && (!product.originalPrice || product.originalPrice < liveMRP)) {
        product.originalPrice = liveMRP;
      }
      product.priceUpdatedAt = now;

      // Update or insert today's normalized daily checkpoint in priceHistory (Rule #12)
      if (!Array.isArray(product.priceHistory)) product.priceHistory = [];

      const existingTodayIdx = product.priceHistory.findIndex((h) => {
        if (h.date === todayStr) return true;
        if (h.timestamp) {
          return new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr;
        }
        return false;
      });

      if (existingTodayIdx >= 0) {
        product.priceHistory[existingTodayIdx].price = livePrice;
        if (liveMRP) product.priceHistory[existingTodayIdx].originalPrice = liveMRP;
        product.priceHistory[existingTodayIdx].date = todayStr;
        product.priceHistory[existingTodayIdx].timestamp = now;
      } else {
        product.priceHistory.push({
          date: todayStr,
          price: livePrice,
          originalPrice: liveMRP || product.originalPrice || livePrice,
          timestamp: now,
        });
      }

      product.priceHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Refresh sync timestamps
    product.lastStoreSyncAt = now;
    product.lastChecked = now;

    // Enhance title and image if available
    if (cleanTitle && (!product.title || product.title === 'Queued for Price Tracking' || product.title === 'Product Item' || product.title === 'Tracked Product' || cleanTitle.length > product.title.length)) {
      product.title = cleanTitle;
    }
    if (cleanImg && (!product.imageUrl || !product.images || product.images.length === 0)) {
      product.imageUrl = cleanImg;
      product.images = [cleanImg];
    }

    applyTrackingAttribution(product, {
      source,
      userId,
      extensionUserId,
      sourceUrl: sourceUrl || parsed.cleanUrl,
      extensionVersion,
      now,
    });

    await product.save();
    console.log(`[API Product Ingest] ✓ Updated product from ${source}: "${product.title}" (${product.productId}) - Live price: ₹${livePrice || product.price} (prior: ₹${priorTrackedPrice})`);

    // If price changed, check existing deals or evaluate price drop
    if (livePrice && priceChanged) {
      try {
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
            }
          } else if (deal.dealPrice && livePrice <= deal.dealPrice) {
            if (deal.isExpired) {
              deal.isExpired = false;
              deal.expiredAt = null;
            }
            deal.lastVerifiedAt = now;
            if (livePrice < deal.dealPrice) {
              const priorDealPrice = deal.dealPrice;
              deal.dealPrice = livePrice;
              deal.discountPercentage = Math.round(((priorDealPrice - livePrice) / priorDealPrice) * 100);
              deal.previousPrice = priorDealPrice;
              deal.priceSource = 'price_history';
            }
            await deal.save();
          }
        }
      } catch (dealErr) {
        console.warn('[API Product Ingest] Deal check notice:', dealErr.message);
      }
    }
  }

  // Unconditionally evaluate User Price Alerts on any live price discovery/update
  if (livePrice && product) {
    evaluateAndTriggerPriceAlerts({
      productId: product.productId,
      livePrice,
      title: product.title,
      dealUrl: product.cleanUrl,
      imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
      merchant: product.merchant || 'amazon',
      country: product.country || 'IN',
    }).catch(err => {
      console.warn('[API Product Ingest] Price alert evaluation warning:', err.message);
    });
  }

  // Invalidate public products cache
  if (apiCache && typeof apiCache.invalidatePattern === 'function') {
    apiCache.invalidatePattern('/api/products');
  }

  if (product) {
    const productObj = product.toObject ? product.toObject() : product;
    const priceStats = computePriceStats(productObj);
    return {
      success: true,
      found: !isNew,
      isNew,
      queued: true,
      message: isNew
        ? 'Product was not in database. Added to database and queued for ongoing price tracking.'
        : 'Product found in database and updated with live price.',
      data: {
        ...productObj,
        priceStats,
      },
    };
  }

  return {
    success: false,
    found: false,
    message: 'Could not ingest or find product.',
  };
}

/**
 * POST /api/products/lookup-url
 * On-demand lookup and price resolution of a pasted product link from Amazon, Flipkart, Myntra, etc.
 * Body: { url: string, title?: string, price?: number, mrp?: number, source?: string, userId?: string, sourceUrl?: string }
 */
router.post('/lookup-url', async (req, res) => {
  try {
    const { url, title, price, mrp, originalPrice, imageUrl, source = 'extension', userId, extensionUserId, sourceUrl, extensionVersion } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    const resolved = await resolveRedirect(url.trim());
    const parsed = parseProductUrl(resolved);

    if (!parsed || !parsed.productId) {
      return res.status(400).json({
        success: false,
        error: 'Could not identify a supported product from the provided URL. Please paste a valid Amazon, Flipkart, or Myntra link.',
      });
    }

    const result = await handleProductDiscoveryOrSync({
      parsed,
      title,
      price,
      mrp,
      originalPrice,
      imageUrl,
      source,
      userId,
      extensionUserId,
      sourceUrl: sourceUrl || url,
      extensionVersion,
    });

    return res.json(result);
  } catch (err) {
    console.error('[API Error] POST /api/products/lookup-url failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to lookup product URL' });
  }
});

/**
 * POST /api/products/track
 * Ingests and queues a product discovered via extension or user browsing.
 * Non-blocking: immediately stores baseline in MongoDB Atlas and enqueues background scrape.
 * Body: { url, title, price, mrp, originalPrice, imageUrl, source, userId, extensionUserId, sourceUrl, extensionVersion }
 */
router.post('/track', async (req, res) => {
  try {
    const {
      url, title, price, mrp, originalPrice, imageUrl,
      source = 'extension',
      userId,
      extensionUserId,
      sourceUrl,
      extensionVersion,
    } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    const resolved = await resolveRedirect(url.trim());
    const parsed = parseProductUrl(resolved);

    if (!parsed || !parsed.productId) {
      return res.status(400).json({
        success: false,
        error: 'Could not identify a supported product from the provided URL.',
      });
    }

    const result = await handleProductDiscoveryOrSync({
      parsed,
      title,
      price,
      mrp,
      originalPrice,
      imageUrl,
      source,
      userId,
      extensionUserId,
      sourceUrl: sourceUrl || url,
      extensionVersion,
    });

    return res.json(result);
  } catch (err) {
    console.error('[API Error] POST /api/products/track failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to track product' });
  }
});

/**
 * GET /api/products/lookup
 * Query param version: GET /api/products/lookup?url=...&title=...&price=...&source=extension&userId=...&sourceUrl=...
 */
router.get('/lookup', async (req, res) => {
  try {
    const {
      url, title, price, mrp, originalPrice, imageUrl,
      source,
      userId,
      extensionUserId,
      sourceUrl,
      extensionVersion,
    } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url query parameter is required' });
    }

    const resolved = await resolveRedirect(url.trim());
    const parsed = parseProductUrl(resolved);

    if (!parsed || !parsed.productId) {
      return res.status(400).json({
        success: false,
        error: 'Could not identify a supported product from the provided URL.',
      });
    }

    const result = await handleProductDiscoveryOrSync({
      parsed,
      title,
      price,
      mrp,
      originalPrice,
      imageUrl,
      source: source || 'extension',
      userId,
      extensionUserId,
      sourceUrl: sourceUrl || url,
      extensionVersion,
    });

    return res.json(result);
  } catch (err) {
    console.error('[API Error] GET /api/products/lookup failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to lookup product URL' });
  }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', cacheMiddleware(30), async (req, res) => {
  try {
    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      const targetCountry = req.query.country ? req.query.country.toUpperCase() : 'IN';
      product = await Product.findOne({ productId: req.params.id, country: targetCountry });
      if (!product) {
        product = await Product.findOne({ productId: req.params.id });
      }
    }
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    let data = product.toObject ? product.toObject() : { ...product };
    if (!data.imageUrl && (!data.images || data.images.length === 0)) {
      const fallback = await Deal.findOne({ productId: data.productId, merchant: data.merchant })
        .select('imageUrl images').lean();
      if (fallback && (fallback.imageUrl || (fallback.images && fallback.images.length > 0))) {
        data.imageUrl = fallback.imageUrl || fallback.images[0];
        data.images = fallback.images && fallback.images.length > 0 ? fallback.images : [data.imageUrl];
        data.imageIsFromDeal = true;
      }
    }

    // Attach computed price statistics and buying verdict
    data.priceStats = computePriceStats(data);

    res.json({ success: true, data });
  } catch (err) {
    console.error(`[API Error] GET /api/products/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/products/:id/scrape-logs
 * Returns scraping log history for this specific product (by cleanUrl, URL, and productId)
 */
router.get('/:id/scrape-logs', async (req, res) => {
  try {
    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      product = await Product.findOne({ productId: req.params.id });
    }
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const urlConditions = [];
    if (product.cleanUrl) urlConditions.push({ url: product.cleanUrl });
    if (product.productId) urlConditions.push({ url: { $regex: product.productId, $options: 'i' } });

    const query = urlConditions.length > 0 ? { $or: urlConditions } : { url: product.cleanUrl };

    const logs = await ScrapingLog.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const totalScrapes = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const errorCount = logs.filter(l => l.status !== 'success').length;
    const lastScrape = logs[0] || null;

    res.json({
      success: true,
      productId: product.productId,
      cleanUrl: product.cleanUrl,
      stats: {
        totalScrapes,
        successCount,
        errorCount,
        lastScrapeAt: lastScrape ? lastScrape.createdAt : product.lastChecked,
        lastStatus: lastScrape ? lastScrape.status : (product.priceSource ? 'success' : 'scraped'),
        priceHistoryCount: (product.priceHistory || []).length
      },
      priceHistory: product.priceHistory || [],
      logs
    });
  } catch (err) {
    console.error(`[API Error] GET /api/products/${req.params.id}/scrape-logs failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/products/:id/refresh-live
 * Instant synchronous live re-scrape and price update on demand.
 */
router.post('/:id/refresh-live', async (req, res) => {
  try {
    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      product = await Product.findOne({ productId: req.params.id });
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (!product.cleanUrl) {
      return res.status(400).json({ success: false, error: 'Product does not have a valid store URL' });
    }

    console.log(`[API Live Refresh] Live scraping "${product.title}" (${product.cleanUrl})...`);
    const scraped = await scrapeProductUrl(product.cleanUrl, PRIORITY.INTERACTIVE);

    if (!scraped || !scraped.price) {
      return res.status(502).json({
        success: false,
        error: 'Could not fetch live price from store at this moment. Please try again shortly.',
      });
    }

    const previousPrice = product.price;
    const livePrice = scraped.price;
    // Guard: prioritize freshly scraped MRP, falling back to stored product MRP
    const rawMRP = scraped.originalPrice || product.originalPrice || null;
    const canonicalMRP = (() => {
      if (!rawMRP || !livePrice) return rawMRP;
      if (rawMRP < livePrice) return livePrice;
      if (rawMRP > livePrice * 15) return livePrice;
      return rawMRP;
    })() || livePrice;
    const now = new Date();
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Update Daily Checkpoint in priceHistory
    if (!product.priceHistory) product.priceHistory = [];
    const todayIdx = product.priceHistory.findIndex(h => h.date === todayStr || (h.timestamp && new Date(h.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayStr));
    if (todayIdx >= 0) {
      product.priceHistory[todayIdx].price = livePrice;
      product.priceHistory[todayIdx].originalPrice = canonicalMRP;
      product.priceHistory[todayIdx].date = todayStr;
      product.priceHistory[todayIdx].timestamp = now;
    } else {
      product.priceHistory.push({
        date: todayStr,
        price: livePrice,
        originalPrice: canonicalMRP,
        timestamp: now,
      });
    }
    product.priceHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    product.price = livePrice;
    product.originalPrice = canonicalMRP;
    product.priceUpdatedAt = now;
    product.lastChecked = now;
    product.priceSource = 'scraped';
    if (scraped.title && (!product.title || product.title === 'Product Item')) {
      product.title = scraped.title;
    }
    if (scraped.images && scraped.images.length > 0 && (!product.images || product.images.length === 0)) {
      product.images = scraped.images;
      product.imageUrl = scraped.imageUrl || scraped.images[0];
    }
    // Update variant from freshly scraped title (re-extract if title changed or variant not yet set)
    if (scraped.variant || !product.variant?.display) {
      product.variant = scraped.variant || extractVariant(product.title);
    }
    await product.save();

    // Check and update associated deals
    const deals = await Deal.find({
      $or: [
        { productId: product.productId },
        { dealUrl: product.cleanUrl }
      ]
    });
    for (const deal of deals) {
      if (deal.dealPrice && livePrice > deal.dealPrice) {
        deal.isExpired = true;
        deal.expiredAt = now;
        deal.lastVerifiedAt = now;
        await deal.save();
      } else if (deal.dealPrice && livePrice <= deal.dealPrice) {
        deal.isExpired = false;
        deal.lastVerifiedAt = now;
        if (livePrice < deal.dealPrice) {
          deal.dealPrice = livePrice;
          if (canonicalMRP > livePrice) {
            deal.discountPercentage = Math.round(((canonicalMRP - livePrice) / canonicalMRP) * 100);
          }
        }
        await deal.save();
      }
    }

    const productObj = product.toObject ? product.toObject() : product;
    const priceStats = computePriceStats(productObj);

    res.json({
      success: true,
      livePrice,
      previousPrice,
      priceChanged: livePrice !== previousPrice,
      verifiedAt: now,
      data: {
        ...productObj,
        priceStats,
      },
    });
  } catch (err) {
    console.error(`[API Error] POST /api/products/${req.params.id}/refresh-live failed:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to refresh live price' });
  }
});

/**
 * GET /api/products/:id/cross-store-compare
 * Finds real cross-store prices for equivalent products across Amazon, Flipkart, Myntra, etc.
 */
router.get('/:id/cross-store-compare', cacheMiddleware(30), async (req, res) => {
  try {
    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      const targetCountry = req.query.country ? req.query.country.toUpperCase() : 'IN';
      product = await Product.findOne({ productId: req.params.id, country: targetCountry });
      if (!product) {
        product = await Product.findOne({ productId: req.params.id });
      }
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const currentMerchant = (product.merchant || 'amazon').toLowerCase();
    const currentPrice = Number(product.price) || 0;

    // Derive the variant for this product (use stored value or extract fresh from title)
    const currentVariant = product.variant?.display
      ? product.variant
      : extractVariant(product.title);

    // Extract brand, model identifiers, and search query tokens
    const brand = extractBrand(product.title);
    const models = extractModelIdentifiers(product.title);
    const tokens = tokenizeTitle(product.title);
    const cleanSearchQuery = [brand, ...tokens.slice(0, 5)].filter(Boolean).join(' ');

    const targetCountry = (product.country || 'IN').toUpperCase();

    const STORES_CONFIG = [
      {
        id: 'amazon',
        name: targetCountry === 'US' ? 'Amazon US' : 'Amazon India',
        logo: '🛍️',
        searchUrl: (q) => targetCountry === 'US'
          ? `https://www.amazon.com/s?k=${encodeURIComponent(q)}`
          : `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
      },
      {
        id: 'flipkart',
        name: 'Flipkart',
        logo: '⚡',
        searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
      },
      {
        id: 'myntra',
        name: 'Myntra',
        logo: '👗',
        searchUrl: (q) => `https://www.myntra.com/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}`,
      },
      {
        id: 'nykaa',
        name: 'Nykaa',
        logo: '💄',
        searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,
      },
      {
        id: 'croma',
        name: 'Croma',
        logo: '🔌',
        searchUrl: (q) => `https://www.croma.com/searchB?q=${encodeURIComponent(q)}`,
      },
      {
        id: 'ajio',
        name: 'Ajio',
        logo: '🕶️',
        searchUrl: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
      }
    ];

    // 1. Strict Candidate Query: Match exact brand AND key model / title tokens
    const specificTokens = [...models, ...tokens.filter(t => t.length >= 3 && t !== brand)].slice(0, 4);
    let candidateProducts = [];

    if (brand && specificTokens.length > 0) {
      const strictQuery = {
        merchant: { $ne: currentMerchant },
        country: targetCountry,
        price: { $gt: 0 },
        isActive: { $ne: false },
        title: new RegExp('\\b' + brand, 'i'),
        $or: specificTokens.map(tok => ({ title: new RegExp(tok, 'i') }))
      };
      candidateProducts = await Product.find(strictQuery)
        .select('_id productId merchant title cleanUrl price category images imageUrl country variant')
        .limit(100)
        .lean();
    }

    // 2. Broad Fallback Candidate Query if strict query returns few candidates
    if (candidateProducts.length < 5) {
      const broadConditions = [];
      if (brand && brand.length >= 2) {
        broadConditions.push({ title: new RegExp('\\b' + brand, 'i') });
      }
      for (const m of models) {
        if (m.length >= 2) {
          broadConditions.push({ title: new RegExp(m, 'i') });
        }
      }
      if (broadConditions.length === 0 && tokens.length > 0) {
        broadConditions.push({ title: new RegExp(tokens[0], 'i') });
      }

      const candidateQuery = {
        merchant: { $ne: currentMerchant },
        country: targetCountry,
        price: { $gt: 0 },
        isActive: { $ne: false },
        $or: broadConditions,
      };

      const fallbackCandidates = await Product.find(candidateQuery)
        .select('_id productId merchant title cleanUrl price category images imageUrl country variant')
        .limit(100)
        .lean();

      // Deduplicate
      const seen = new Set(candidateProducts.map(p => p._id.toString()));
      for (const fc of fallbackCandidates) {
        if (!seen.has(fc._id.toString())) {
          candidateProducts.push(fc);
          seen.add(fc._id.toString());
        }
      }
    }

    // Run Semantic Vector Matching & Cosine Ranking with Specification Parity
    const { exactMatches, similarMatches } = rankCrossStoreMatches(product, candidateProducts);

    const stores = [];
    let bestSavings = 0;
    let savingsMessage = null;
    let bestStoreName = null;

    // 1. Primary Store (The store of the product being viewed)
    const primaryConf = STORES_CONFIG.find(c => c.id === currentMerchant) || {
      id: currentMerchant,
      name: currentMerchant.charAt(0).toUpperCase() + currentMerchant.slice(1),
      logo: '🛒'
    };

    stores.push({
      id: currentMerchant,
      name: primaryConf.name,
      logo: primaryConf.logo,
      price: currentPrice,
      hasRealPrice: true,
      inStock: product.isActive !== false,
      delivery: 'Current Store',
      isPrimary: true,
      url: product.cleanUrl,
      buttonText: 'Buy on ' + primaryConf.name,
      priceDifference: 0,
      isCheaper: false,
      statusBadge: 'Current Deal',
      savingsAmount: 0,
    });

    // 2. Secondary Stores with Exact Matches & Fallback Searches
    for (const conf of STORES_CONFIG) {
      if (conf.id === currentMerchant) continue;

      // Check if vector matching found an exact match on this store
      const exactMatch = exactMatches.find(m => m.product.merchant && m.product.merchant.toLowerCase() === conf.id);

      if (exactMatch && exactMatch.product.price) {
        const matchedPrice = Number(exactMatch.product.price);
        const priceDifference = currentPrice - matchedPrice; // positive means other store is cheaper
        const isOtherStoreCheaper = priceDifference > 0;
        const isOtherStoreMoreExpensive = priceDifference < 0;

        let statusBadge = 'Same Price';
        let savingsAmount = 0;
        if (isOtherStoreCheaper) {
          savingsAmount = priceDifference;
          statusBadge = targetCountry === 'US'
            ? `Save $${priceDifference.toFixed(2)}`
            : `Save ₹${priceDifference.toLocaleString('en-IN')}`;
          if (priceDifference > bestSavings) {
            bestSavings = priceDifference;
            bestStoreName = conf.name;
            savingsMessage = targetCountry === 'US'
              ? `Save $${priceDifference.toFixed(2)} on ${conf.name}!`
              : `Save ₹${priceDifference.toLocaleString('en-IN')} on ${conf.name}!`;
          }
        } else if (isOtherStoreMoreExpensive) {
          statusBadge = targetCountry === 'US'
            ? `+$${Math.abs(priceDifference).toFixed(2)}`
            : `+₹${Math.abs(priceDifference).toLocaleString('en-IN')}`;
        }

        const matchedVariant = exactMatch.product.variant?.display
          ? exactMatch.product.variant
          : extractVariant(exactMatch.product.title);
        const mismatch = !variantsMatch(currentVariant, matchedVariant);
        const mismatchReason = mismatch ? variantMismatchReason(currentVariant, matchedVariant) : null;

        stores.push({
          id: conf.id,
          name: conf.name,
          logo: conf.logo,
          price: matchedPrice,
          hasRealPrice: true,
          matchScore: exactMatch.matchScore,
          inStock: exactMatch.product.isActive !== false,
          delivery: 'Verified Exact Match',
          isPrimary: false,
          url: exactMatch.product.cleanUrl,
          matchedProductId: exactMatch.product._id || exactMatch.product.productId,
          buttonText: isOtherStoreCheaper
            ? (targetCountry === 'US' ? `Buy for $${matchedPrice.toFixed(2)}` : `Buy for ₹${matchedPrice.toLocaleString('en-IN')}`)
            : `View on ${conf.name}`,
          priceDifference,
          isCheaper: isOtherStoreCheaper,
          statusBadge,
          savingsAmount,
          matchedVariant: matchedVariant ? matchedVariant.display : null,
          variantMismatch: mismatch,
          variantWarning: mismatchReason,
        });
      } else {
        // Fallback to genuine targeted search link
        stores.push({
          id: conf.id,
          name: conf.name,
          logo: conf.logo,
          price: null,
          hasRealPrice: false,
          inStock: true,
          delivery: 'Compare on Store',
          isPrimary: false,
          url: conf.searchUrl(cleanSearchQuery),
          buttonText: 'Search on ' + conf.name,
          priceDifference: null,
          isCheaper: false,
          statusBadge: null,
          savingsAmount: 0,
        });
      }
    }

    const cheaperStoreObj = stores.find(s => s.isCheaper && s.savingsAmount > 0);

    res.json({
      success: true,
      query: cleanSearchQuery,
      currentVariant: currentVariant ? currentVariant.display : null,
      stores,
      exactMatchesCount: exactMatches.length,
      hasExactMatch: exactMatches.length > 0,
      bestSavings,
      savingsMessage,
      bestStoreName,
      comparison: {
        hasCheaper: bestSavings > 0,
        cheaperStore: bestStoreName,
        cheaperPrice: cheaperStoreObj ? cheaperStoreObj.price : null,
        currentPrice: currentPrice,
        saving: bestSavings,
        cheaperUrl: cheaperStoreObj ? cheaperStoreObj.url : null,
        savingsMessage: savingsMessage,
      },
      similarMatches: similarMatches.slice(0, 4).map(m => ({
        _id: m.product._id,
        productId: m.product.productId,
        title: m.product.title,
        merchant: m.product.merchant,
        price: m.product.price,
        imageUrl: m.product.imageUrl || (m.product.images && m.product.images[0]),
        cleanUrl: m.product.cleanUrl,
        matchScore: m.matchScore,
        variant: m.product.variant?.display || extractVariant(m.product.title)?.display || null,
        mismatchReason: m.matchDetails?.mismatchReason || null,
      }))
    });
  } catch (err) {
    console.error('[API Error] GET /api/products/:id/cross-store-compare failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to compare store prices' });
  }
});

/**
 * POST /api/products/compare-url
 * Universal URL endpoint: accepts any store URL (Amazon, Flipkart, etc.),
 * resolves the product, and returns its live cross-store comparison table & savings.
 */
router.post('/compare-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Product URL is required' });
    }

    const resolved = await resolveRedirect(url.trim());
    const parsed = parseProductUrl(resolved);

    if (!parsed || !parsed.productId) {
      return res.status(400).json({
        success: false,
        error: 'Could not identify a supported product from the provided URL.',
      });
    }

    const syncRes = await handleProductDiscoveryOrSync({
      parsed,
      source: 'web_compare',
      sourceUrl: url,
    });

    if (!syncRes || !syncRes.data) {
      return res.status(404).json({ success: false, error: 'Product could not be resolved' });
    }

    const product = syncRes.data;
    const targetCountry = (product.country || 'IN').toUpperCase();
    const currentMerchant = (product.merchant || 'amazon').toLowerCase();
    const currentPrice = Number(product.price) || 0;

    const brand = extractBrand(product.title);
    const models = extractModelIdentifiers(product.title);
    const tokens = tokenizeTitle(product.title);
    const cleanSearchQuery = [brand, ...tokens.slice(0, 5)].filter(Boolean).join(' ');

    const specificTokens = [...models, ...tokens.filter(t => t.length >= 3 && t !== brand)].slice(0, 4);
    let candidateProducts = [];

    if (brand && specificTokens.length > 0) {
      candidateProducts = await Product.find({
        merchant: { $ne: currentMerchant },
        country: targetCountry,
        price: { $gt: 0 },
        isActive: { $ne: false },
        title: new RegExp('\\b' + brand, 'i'),
        $or: specificTokens.map(tok => ({ title: new RegExp(tok, 'i') }))
      }).select('_id productId merchant title cleanUrl price category images imageUrl country variant').limit(80).lean();
    }

    if (candidateProducts.length < 5) {
      const broadConditions = [];
      if (brand && brand.length >= 2) broadConditions.push({ title: new RegExp('\\b' + brand, 'i') });
      for (const m of models) broadConditions.push({ title: new RegExp(m, 'i') });
      if (broadConditions.length === 0 && tokens.length > 0) broadConditions.push({ title: new RegExp(tokens[0], 'i') });
      const fallback = await Product.find({
        merchant: { $ne: currentMerchant },
        country: targetCountry,
        price: { $gt: 0 },
        isActive: { $ne: false },
        $or: broadConditions,
      }).select('_id productId merchant title cleanUrl price category images imageUrl country variant').limit(80).lean();

      const seen = new Set(candidateProducts.map(p => p._id.toString()));
      for (const fc of fallback) {
        if (!seen.has(fc._id.toString())) {
          candidateProducts.push(fc);
          seen.add(fc._id.toString());
        }
      }
    }

    const { exactMatches, similarMatches } = rankCrossStoreMatches(product, candidateProducts);

    const STORES_CONFIG = [
      { id: 'amazon', name: targetCountry === 'US' ? 'Amazon US' : 'Amazon India', logo: '🛍️', searchUrl: (q) => targetCountry === 'US' ? `https://www.amazon.com/s?k=${encodeURIComponent(q)}` : `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
      { id: 'flipkart', name: 'Flipkart', logo: '⚡', searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}` },
      { id: 'myntra', name: 'Myntra', logo: '👗', searchUrl: (q) => `https://www.myntra.com/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}` },
      { id: 'nykaa', name: 'Nykaa', logo: '💄', searchUrl: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}` },
      { id: 'croma', name: 'Croma', logo: '🔌', searchUrl: (q) => `https://www.croma.com/searchB?q=${encodeURIComponent(q)}` },
      { id: 'ajio', name: 'Ajio', logo: '🕶️', searchUrl: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}` }
    ];

    const stores = [];
    let bestSavings = 0;
    let savingsMessage = null;
    let bestStoreName = null;

    const primaryConf = STORES_CONFIG.find(c => c.id === currentMerchant) || {
      id: currentMerchant,
      name: currentMerchant.charAt(0).toUpperCase() + currentMerchant.slice(1),
      logo: '🛒'
    };

    stores.push({
      id: currentMerchant,
      name: primaryConf.name,
      logo: primaryConf.logo,
      price: currentPrice,
      hasRealPrice: true,
      inStock: product.isActive !== false,
      isPrimary: true,
      url: product.cleanUrl,
      buttonText: 'Buy on ' + primaryConf.name,
      priceDifference: 0,
      isCheaper: false,
      savingsAmount: 0,
    });

    for (const conf of STORES_CONFIG) {
      if (conf.id === currentMerchant) continue;
      const exactMatch = exactMatches.find(m => m.product.merchant && m.product.merchant.toLowerCase() === conf.id);
      if (exactMatch && exactMatch.product.price) {
        const matchedPrice = Number(exactMatch.product.price);
        const priceDifference = currentPrice - matchedPrice;
        const isOtherStoreCheaper = priceDifference > 0;
        let savingsAmount = 0;
        if (isOtherStoreCheaper) {
          savingsAmount = priceDifference;
          if (priceDifference > bestSavings) {
            bestSavings = priceDifference;
            bestStoreName = conf.name;
            savingsMessage = targetCountry === 'US'
              ? `Save $${priceDifference.toFixed(2)} on ${conf.name}!`
              : `Save ₹${priceDifference.toLocaleString('en-IN')} on ${conf.name}!`;
          }
        }
        stores.push({
          id: conf.id,
          name: conf.name,
          logo: conf.logo,
          price: matchedPrice,
          hasRealPrice: true,
          matchScore: exactMatch.matchScore,
          inStock: exactMatch.product.isActive !== false,
          isPrimary: false,
          url: exactMatch.product.cleanUrl,
          matchedProductId: exactMatch.product._id || exactMatch.product.productId,
          buttonText: isOtherStoreCheaper ? (targetCountry === 'US' ? `Buy for $${matchedPrice.toFixed(2)}` : `Buy for ₹${matchedPrice.toLocaleString('en-IN')}`) : `View on ${conf.name}`,
          priceDifference,
          isCheaper: isOtherStoreCheaper,
          savingsAmount,
        });
      } else {
        stores.push({
          id: conf.id,
          name: conf.name,
          logo: conf.logo,
          price: null,
          hasRealPrice: false,
          inStock: true,
          isPrimary: false,
          url: conf.searchUrl(cleanSearchQuery),
          buttonText: 'Search on ' + conf.name,
          priceDifference: null,
          isCheaper: false,
          savingsAmount: 0,
        });
      }
    }

    const cheaperStoreObj = stores.find(s => s.isCheaper && s.savingsAmount > 0);

    res.json({
      success: true,
      product,
      query: cleanSearchQuery,
      stores,
      bestSavings,
      savingsMessage,
      bestStoreName,
      comparison: {
        hasCheaper: bestSavings > 0,
        cheaperStore: bestStoreName,
        cheaperPrice: cheaperStoreObj ? cheaperStoreObj.price : null,
        currentPrice: currentPrice,
        saving: bestSavings,
        cheaperUrl: cheaperStoreObj ? cheaperStoreObj.url : null,
        savingsMessage: savingsMessage,
      },
      similarMatches: similarMatches.slice(0, 4)
    });
  } catch (err) {
    console.error('[API Error] POST /api/products/compare-url failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to compare product URL' });
  }
});

/**
 * GET /api/products/:id/variants
 * Returns grouped series siblings for variants (storage, color, beauty shades, sizes).
 */
router.get('/:id/variants', cacheMiddleware(30), async (req, res) => {
  try {
    let product = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id);
    }
    if (!product) {
      const targetCountry = req.query.country ? req.query.country.toUpperCase() : 'IN';
      product = await Product.findOne({ productId: req.params.id, country: targetCountry });
      if (!product) {
        product = await Product.findOne({ productId: req.params.id });
      }
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const seriesKey = generateSeriesKey(product.title, product.category, product.brand);
    if (!seriesKey) {
      return res.json({
        success: true,
        hasVariants: false,
        seriesKey: null,
        currentVariantId: product._id,
        dimensions: { storages: [], colors: [], shades: [], sizes: [] },
        variants: [],
      });
    }

    const targetCountry = (product.country || 'IN').toUpperCase();

    // Fast candidate retrieval:
    // Extract key tokens to query MongoDB efficiently
    const keyTokens = seriesKey.split('-').filter(t => t.length > 2);
    const searchConditions = keyTokens.slice(0, 3).map(tok => ({ title: new RegExp('\\b' + tok, 'i') }));

    const candidateQuery = {
      country: targetCountry,
      price: { $gt: 0 },
      isActive: { $ne: false },
      $and: searchConditions,
    };

    const candidates = await Product.find(candidateQuery)
      .select('_id productId title price originalPrice previousPrice discountPercentage merchant imageUrl images cleanUrl variant isActive')
      .limit(60)
      .lean();

    // Verify candidates against exact seriesKey
    const siblings = candidates.filter(c => generateSeriesKey(c.title, product.category, product.brand) === seriesKey);

    // If current product wasn't found in candidates for some reason, ensure it's included
    if (!siblings.some(s => String(s._id) === String(product._id))) {
      siblings.push(product.toObject ? product.toObject() : product);
    }

    // Sort siblings by price ascending
    siblings.sort((a, b) => (a.price || 0) - (b.price || 0));

    const isUsableImg = (u) => u && typeof u === 'string' && !u.includes('images-na.ssl-images-amazon.com/images/P/') && !u.includes('placeholder.png');
    const seriesHeroImage = siblings.find(s => isUsableImg(s.imageUrl))?.imageUrl || '';

    // Extract traits for each sibling
    const variantList = siblings.map(s => {
      const traits = extractVariantTraits(s.title, product.category, s.variant);
      const isCurrent = String(s._id) === String(product._id);
      const discountPct = (s.originalPrice && s.price && s.originalPrice > s.price)
        ? Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100)
        : (s.discountPercentage || 0);

      let effectiveImg = s.imageUrl || (s.images && s.images[0]) || '';
      if (!isUsableImg(effectiveImg)) {
        const colorSibling = traits.color ? siblings.find(sib => {
          const sibTraits = extractVariantTraits(sib.title, product.category, sib.variant);
          return sibTraits.color && sibTraits.color.toLowerCase() === traits.color.toLowerCase() && isUsableImg(sib.imageUrl);
        }) : null;
        effectiveImg = colorSibling ? colorSibling.imageUrl : seriesHeroImage;
      }

      return {
        _id: s._id,
        productId: s.productId,
        title: s.title,
        price: s.price,
        originalPrice: s.originalPrice || s.price,
        discountPercentage: discountPct,
        merchant: s.merchant,
        imageUrl: effectiveImg,
        cleanUrl: s.cleanUrl,
        storage: traits.storage,
        storageGb: traits.storageGb,
        ram: traits.ram,
        ramGb: traits.ramGb,
        color: traits.color,
        shade: traits.shade,
        size: traits.size,
        chip: traits.chip,
        screenSize: traits.screenSize,
        inStock: s.isActive !== false,
        isCurrent,
      };
    });

    // Derive aggregated dimensions
    const storagesSet = new Set();
    const colorsMap = new Map();
    const shadesMap = new Map();
    const sizesSet = new Set();

    for (const v of variantList) {
      if (v.storage) storagesSet.add(v.storage);
      if (v.size) sizesSet.add(v.size);

      if (v.color) {
        const cLower = v.color.toLowerCase();
        if (!colorsMap.has(cLower)) {
          colorsMap.set(cLower, {
            name: v.color,
            hex: COLOR_HEX_MAP[cLower] || '#94A3B8',
            cheapestPrice: v.price,
            productId: v._id,
            isCurrent: v.isCurrent,
            inStock: v.inStock,
          });
        } else {
          const existing = colorsMap.get(cLower);
          if (v.isCurrent) existing.isCurrent = true;
          if (v.price && v.price < existing.cheapestPrice) {
            existing.cheapestPrice = v.price;
            existing.productId = v._id;
          }
        }
      }

      if (v.shade) {
        const sKey = v.shade.toLowerCase();
        if (!shadesMap.has(sKey)) {
          shadesMap.set(sKey, {
            name: v.shade,
            hex: getBeautyShadeHex(v.shade),
            cheapestPrice: v.price,
            productId: v._id,
            isCurrent: v.isCurrent,
            inStock: v.inStock,
          });
        } else {
          const existing = shadesMap.get(sKey);
          if (v.isCurrent) existing.isCurrent = true;
          if (v.price && v.price < existing.cheapestPrice) {
            existing.cheapestPrice = v.price;
            existing.productId = v._id;
          }
        }
      }
    }

    // Sort storages numerically: 128GB, 256GB, 512GB, 1TB
    const storages = Array.from(storagesSet).sort((a, b) => {
      const aVal = a.toLowerCase().includes('tb') ? parseFloat(a) * 1024 : parseFloat(a);
      const bVal = b.toLowerCase().includes('tb') ? parseFloat(b) * 1024 : parseFloat(b);
      return aVal - bVal;
    });

    const colors = Array.from(colorsMap.values());
    const shades = Array.from(shadesMap.values());
    const sizes = Array.from(sizesSet);

    // Human-friendly series title
    const currentTraits = extractVariantTraits(product.title, product.category, product.variant);
    let seriesName = product.title.split(/[,;(|\-–]/)[0].trim();
    if (seriesKey.startsWith('apple-macbook')) {
      const family = seriesKey.includes('neo') ? 'MacBook Neo' : (seriesKey.includes('air') ? 'MacBook Air' : 'MacBook Pro');
      const screen = currentTraits.screenSize || (seriesKey.includes('13') ? '13"' : (seriesKey.includes('15') ? '15"' : '14"'));
      const chip = currentTraits.chip ? ` (${currentTraits.chip})` : '';
      seriesName = `Apple ${family} ${screen}${chip}`;
    }

    const hasVariants = variantList.length > 1;

    res.json({
      success: true,
      hasVariants,
      seriesKey,
      seriesName,
      currentVariantId: product._id,
      currentTraits,
      dimensions: {
        storages,
        colors,
        shades,
        sizes,
      },
      variants: variantList,
      totalVariants: variantList.length,
    });
  } catch (err) {
    console.error(`[API Error] GET /api/products/${req.params.id}/variants failed:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch product variants' });
  }
});

/**
 * POST /api/products/bulk-delete
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, error: 'productIds array is required' });
    }

    // Match associated deals by productId+merchant, not dealUrl — the same product's dealUrl can
    // legitimately differ from its Product.cleanUrl (e.g. Flipkart resolves the same pid through
    // different landing-page slugs depending on the source link), so a dealUrl-only match misses
    // deals for the product being deleted here.
    const products = await Product.find({ _id: { $in: productIds } });
    const identityOr = products.map(p => ({ productId: p.productId, merchant: p.merchant })).filter(x => x.productId);
    const cleanUrls = products.map(p => p.cleanUrl).filter(Boolean);

    if (identityOr.length > 0 || cleanUrls.length > 0) {
      const or = [...identityOr];
      if (cleanUrls.length > 0) or.push({ dealUrl: { $in: cleanUrls } });
      await Deal.deleteMany({ $or: or });
    }

    // Delete the products
    const result = await Product.deleteMany({ _id: { $in: productIds } });

    res.json({ success: true, message: `Deleted ${result.deletedCount} products and associated deals` });
  } catch (err) {
    console.error(`[API Error] POST /api/products/bulk-delete failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Match by productId+merchant, not just dealUrl (see bulk-delete above for why)
    const or = [];
    if (product.productId) or.push({ productId: product.productId, merchant: product.merchant });
    if (product.cleanUrl) or.push({ dealUrl: product.cleanUrl });
    if (or.length > 0) {
      await Deal.deleteMany({ $or: or });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Product and associated deals deleted successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/products/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
