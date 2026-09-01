import express from 'express';
import mongoose from 'mongoose';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import ScrapingLog from '../db/models/scrapingLog.js';
import { computePriceStats } from '../utils/priceAnalytics.js';
import { resolveRedirect, parseProductUrl } from '../utils/urlParser.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { rankCrossStoreMatches, extractBrand, tokenizeTitle } from '../utils/vectorMatcher.js';
import { extractVariant, variantsMatch, variantMismatchReason } from '../utils/variantExtractor.js';
import { cacheMiddleware } from '../utils/cache.js';
import { PRIORITY } from '../services/scraperQueue.js';

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
        query.$or = [{ country: 'IN' }, { country: { $exists: false } }, { country: null }];
      } else {
        query.country = cCode;
      }
    }

    if (req.query.flagged === 'true') {
      query.isFlagged = true;
    } else if (req.query.flagged === 'false') {
      query.$and = (query.$and || []).concat([{ $or: [{ isFlagged: false }, { isFlagged: { $exists: false } }] }]);
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
      query.$or = [
        { imageUrl: { $exists: true, $ne: null, $ne: '' } },
        { 'images.0': { $exists: true } }
      ];
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
        dealsCount: dealCountMap.get(obj.productId) || 0
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
 * POST /api/products/lookup-url
 * On-demand lookup and price resolution of a pasted product link from Amazon, Flipkart, Myntra, etc.
 * Body: { url: string }
 */
router.post('/lookup-url', async (req, res) => {
  try {
    const { url } = req.body;
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

    let product = await Product.findOne({ productId: parsed.productId, merchant: parsed.merchant });
    if (!product) {
      product = await Product.findOne({ productId: parsed.productId });
    }

    // If not in Product collection, check Deal collection
    if (!product) {
      const deal = await Deal.findOne({ productId: parsed.productId, merchant: parsed.merchant })
        .sort({ createdAt: -1 });
      if (deal) {
        product = new Product({
          productId: parsed.productId,
          cleanUrl: parsed.cleanUrl || deal.dealUrl,
          merchant: parsed.merchant,
          title: deal.title || 'Product Item',
          imageUrl: deal.imageUrl || (deal.images && deal.images[0]) || '',
          images: deal.images || (deal.imageUrl ? [deal.imageUrl] : []),
          price: deal.dealPrice || deal.originalPrice,
          originalPrice: deal.originalPrice || deal.dealPrice,
          priceUpdatedAt: deal.createdAt || new Date(),
          priceHistory: [
            {
              price: deal.dealPrice || deal.originalPrice,
              originalPrice: deal.originalPrice || deal.dealPrice,
              timestamp: deal.createdAt || new Date(),
            }
          ],
          category: deal.category || 'general',
          subcategory: deal.subcategory || '',
        });
        await product.save();
      }
    }

    // On-Demand Ingestion: If product is still not in DB, live scrape it now!
    if (!product && parsed.cleanUrl) {
      console.log(`[API Lookup] Product not in DB. Initiating instant live scrape for ${parsed.cleanUrl}...`);
      const scraped = await scrapeProductUrl(parsed.cleanUrl, PRIORITY.INTERACTIVE);
      if (scraped && scraped.title) {
        const now = new Date();
        const initialPrice = scraped.price || scraped.originalPrice || 0;
        const initialMRP = scraped.originalPrice || scraped.price || initialPrice;

        product = new Product({
          productId: parsed.productId,
          cleanUrl: parsed.cleanUrl,
          merchant: parsed.merchant,
          title: scraped.title,
          imageUrl: scraped.imageUrl,
          images: scraped.images,
          rating: scraped.rating,
          reviews: scraped.reviews,
          price: initialPrice,
          originalPrice: initialMRP,
          category: scraped.category || 'general',
          priceSource: 'scraped',
          priceUpdatedAt: now,
          priceHistory: initialPrice ? [{
            price: initialPrice,
            originalPrice: initialMRP,
            timestamp: now,
          }] : [],
          lastChecked: now,
          createdAt: now,
          updatedAt: now,
        });
        await product.save();
        console.log(`[API Lookup] ✓ Successfully scraped & ingested new product into DB: "${scraped.title}" (₹${initialPrice})`);
      }
    }

    if (product) {
      const productObj = product.toObject ? product.toObject() : product;
      const priceStats = computePriceStats(productObj);
      return res.json({
        success: true,
        found: true,
        data: {
          ...productObj,
          priceStats,
        },
      });
    }

    // Product could not be scraped / not reachable
    return res.json({
      success: true,
      found: false,
      parsed: {
        merchant: parsed.merchant,
        productId: parsed.productId,
        cleanUrl: parsed.cleanUrl,
      },
      message: 'Product link parsed, but live product details could not be extracted at this moment.',
    });
  } catch (err) {
    console.error('[API Error] POST /api/products/lookup-url failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to lookup product URL' });
  }
});

/**
 * GET /api/products/lookup
 * Query param version: GET /api/products/lookup?url=...
 */
router.get('/lookup', async (req, res) => {
  try {
    const { url } = req.query;
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

    let product = await Product.findOne({ productId: parsed.productId, merchant: parsed.merchant });
    if (!product) {
      product = await Product.findOne({ productId: parsed.productId });
    }

    // On-Demand Ingestion if not found
    if (!product && parsed.cleanUrl) {
      console.log(`[API Lookup GET] Product not in DB. Live scraping ${parsed.cleanUrl}...`);
      const scraped = await scrapeProductUrl(parsed.cleanUrl, PRIORITY.INTERACTIVE);
      if (scraped && scraped.title) {
        const now = new Date();
        const initialPrice = scraped.price || scraped.originalPrice || 0;
        const initialMRP = scraped.originalPrice || scraped.price || initialPrice;

        product = new Product({
          productId: parsed.productId,
          cleanUrl: parsed.cleanUrl,
          merchant: parsed.merchant,
          title: scraped.title,
          imageUrl: scraped.imageUrl,
          images: scraped.images,
          rating: scraped.rating,
          reviews: scraped.reviews,
          price: initialPrice,
          originalPrice: initialMRP,
          category: scraped.category || 'general',
          priceSource: 'scraped',
          priceUpdatedAt: now,
          priceHistory: initialPrice ? [{
            price: initialPrice,
            originalPrice: initialMRP,
            timestamp: now,
          }] : [],
          lastChecked: now,
          createdAt: now,
          updatedAt: now,
        });
        await product.save();
      }
    }

    if (product) {
      const productObj = product.toObject ? product.toObject() : product;
      const priceStats = computePriceStats(productObj);
      return res.json({
        success: true,
        found: true,
        data: {
          ...productObj,
          priceStats,
        },
      });
    }

    return res.json({
      success: true,
      found: false,
      parsed,
    });
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
      product = await Product.findOne({ productId: req.params.id });
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
    // Guard: reject impossible MRP values (inverted or inflated)
    const rawMRP = product.originalPrice || scraped.originalPrice || null;
    const canonicalMRP = (() => {
      if (!rawMRP || !livePrice) return rawMRP;
      if (rawMRP < livePrice) return null;
      if (rawMRP > livePrice * 15) return null;
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
      product = await Product.findOne({ productId: req.params.id });
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

    // Extract brand and search query from product title
    const brand = extractBrand(product.title);
    const tokens = tokenizeTitle(product.title);
    const cleanSearchQuery = [brand, ...tokens.slice(0, 5)].filter(Boolean).join(' ');

    const STORES_CONFIG = [
      {
        id: 'amazon',
        name: 'Amazon India',
        logo: '🛍️',
        searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
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
        id: 'ajio',
        name: 'Ajio',
        logo: '🕶️',
        searchUrl: (q) => `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`,
      }
    ];

    // Find candidate products across all other merchants
    const candidateQuery = { merchant: { $ne: currentMerchant } };
    if (brand && brand.length > 2) {
      candidateQuery.$or = [
        { title: new RegExp(brand, 'i') },
        { category: product.category || 'general' }
      ];
    }

    const candidateProducts = await Product.find(candidateQuery)
      .select('_id productId merchant title cleanUrl price category images imageUrl')
      .limit(60)
      .lean();

    // Run Semantic Vector Matching & Cosine Ranking
    const { exactMatches, similarMatches } = rankCrossStoreMatches(product, candidateProducts);

    const stores = [];

    // 1. Primary Store (The verified store of this product)
    stores.push({
      id: currentMerchant,
      name: currentMerchant === 'amazon' ? 'Amazon India' : currentMerchant.charAt(0).toUpperCase() + currentMerchant.slice(1),
      logo: currentMerchant === 'amazon' ? '🛍️' : currentMerchant === 'flipkart' ? '⚡' : '👗',
      price: currentPrice,
      hasRealPrice: true,
      inStock: product.isActive !== false,
      delivery: 'Fast Delivery',
      isPrimary: true,
      url: product.cleanUrl,
      buttonText: 'Buy on ' + (currentMerchant.charAt(0).toUpperCase() + currentMerchant.slice(1)),
    });

    // 2. Secondary Stores with Vector Matching
    for (const conf of STORES_CONFIG) {
      if (conf.id === currentMerchant) continue;

      // Check if vector matching found an exact match on this store
      const exactMatch = exactMatches.find(m => m.product.merchant && m.product.merchant.toLowerCase() === conf.id);

      if (exactMatch && exactMatch.product.price) {
        const matchedVariant = exactMatch.product.variant?.display
          ? exactMatch.product.variant
          : extractVariant(exactMatch.product.title);
        const mismatch = !variantsMatch(currentVariant, matchedVariant);
        const mismatchReason = mismatch ? variantMismatchReason(currentVariant, matchedVariant) : null;

        stores.push({
          id: conf.id,
          name: conf.name,
          logo: conf.logo,
          price: exactMatch.product.price,
          hasRealPrice: true,
          matchScore: exactMatch.matchScore,
          inStock: exactMatch.product.isActive !== false,
          delivery: 'Verified Match',
          isPrimary: false,
          url: exactMatch.product.cleanUrl,
          matchedProductId: exactMatch.product._id || exactMatch.product.productId,
          buttonText: 'View on ' + conf.name,
          // Variant info
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
        });
      }
    }

    res.json({
      success: true,
      query: cleanSearchQuery,
      currentVariant: currentVariant ? currentVariant.display : null,
      stores,
      exactMatchesCount: exactMatches.length,
      similarMatches: similarMatches.slice(0, 4).map(m => ({
        _id: m.product._id,
        productId: m.product.productId,
        title: m.product.title,
        merchant: m.product.merchant,
        price: m.product.price,
        imageUrl: m.product.imageUrl || (m.product.images && m.product.images[0]),
        cleanUrl: m.product.cleanUrl,
        matchScore: m.matchScore,
      }))
    });
  } catch (err) {
    console.error('[API Error] GET /api/products/:id/cross-store-compare failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to compare store prices' });
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
