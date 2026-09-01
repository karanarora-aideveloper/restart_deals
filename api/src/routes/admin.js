import express from 'express';
import mongoose from 'mongoose';
import { defaultRedis } from '../utils/redis.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import User from '../db/models/user.js';
import { getRefresherStatus, refreshStaleProductBatch } from '../jobs/dailyProductRefresher.js';
import ScrapingLog from '../db/models/scrapingLog.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const totalTokens = await ScrapingAntToken.countDocuments();
    const activeTokens = await ScrapingAntToken.countDocuments({ status: 'active' });
    const exhaustedTokens = await ScrapingAntToken.countDocuments({ status: 'exhausted' });

    const now = new Date();
    const d24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const d7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const d30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      products24h,
      products7d,
      products30d,
      totalDeals,
      activeDeals,
      dealsToday,
      deals24h,
      deals7d,
      deals30d,
      totalUsers,
      missingImagesCount,
      missingMrpCount,
      missingPriceCount,
      abnormalMrpCount,
      productsUpdated24h,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ createdAt: { $gte: d24h } }),
      Product.countDocuments({ createdAt: { $gte: d7d } }),
      Product.countDocuments({ createdAt: { $gte: d30d } }),
      Deal.countDocuments(),
      Deal.countDocuments({ isExpired: { $ne: true } }),
      Deal.countDocuments({ createdAt: { $gte: startOfDay } }),
      Deal.countDocuments({ createdAt: { $gte: d24h } }),
      Deal.countDocuments({ createdAt: { $gte: d7d } }),
      Deal.countDocuments({ createdAt: { $gte: d30d } }),
      User.countDocuments(),
      Product.countDocuments({
        $or: [
          { images: { $size: 0 } },
          { images: { $exists: false } },
          { imageUrl: null },
          { imageUrl: '' },
        ],
      }),
      Product.countDocuments({
        $or: [
          { originalPrice: null },
          { originalPrice: { $exists: false } },
          { originalPrice: { $lte: 0 } },
        ],
      }),
      Product.countDocuments({
        $or: [
          { price: null },
          { price: { $exists: false } },
          { price: { $lte: 0 } },
        ],
      }),
      Product.countDocuments({
        originalPrice: { $exists: true, $ne: null, $gt: 0 },
        price: { $exists: true, $ne: null, $gt: 0 },
        $expr: { $gt: [{ $subtract: ['$originalPrice', '$price'] }, 2000] },
      }),
      // Products updated (price/data refreshed) in last 24h, excluding newly created
      Product.countDocuments({ updatedAt: { $gte: d24h }, createdAt: { $lt: d24h } }),
    ]);

    const [dealsByCountryAgg, productsByCountryAgg, productsByMerchantAgg, productsByCategoryAgg] = await Promise.all([
      Deal.aggregate([
        { $group: { _id: { $ifNull: ["$country", "IN"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Product.aggregate([
        { $group: { _id: { $ifNull: ["$country", "IN"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Product.aggregate([
        { $group: { _id: { $toLower: { $ifNull: ["$merchant", "other"] } }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      Product.aggregate([
        { $group: { _id: { $ifNull: ["$category", "general"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ])
    ]);

    const dealsByCountry = {};
    dealsByCountryAgg.forEach(item => {
      dealsByCountry[item._id] = item.count;
    });

    const productsByCountry = {};
    productsByCountryAgg.forEach(item => {
      productsByCountry[item._id] = item.count;
    });

    const productsByMerchant = {};
    productsByMerchantAgg.forEach(item => {
      productsByMerchant[item._id] = item.count;
    });

    const productsByCategory = {};
    productsByCategoryAgg.forEach(item => {
      productsByCategory[item._id] = item.count;
    });

    res.json({
      status: mongoose.connection.readyState === 1 ? 'Online' : 'Offline',
      queueLength: 0,
      totalProducts,
      products24h,
      productsUpdated24h,
      products7d,
      products30d,
      totalDeals,
      activeDeals,
      dealsToday,
      deals24h,
      deals7d,
      deals30d,
      totalUsers,
      hygiene: {
        missingImages: missingImagesCount,
        missingMrp: missingMrpCount,
        missingPrice: missingPriceCount,
        abnormalMrp: abnormalMrpCount,
        healthy: Math.max(0, totalProducts - (missingImagesCount + missingMrpCount + missingPriceCount)),
      },
      dealsByCountry,
      productsByCountry,
      productsByMerchant,
      productsByCategory,
      tokens: {
        total: totalTokens,
        active: activeTokens,
        exhausted: exhaustedTokens,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive Product Explorer with Advanced Filters
router.get('/products-explorer', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = req.query.search ? req.query.search.trim() : '';
    const timeRange = req.query.timeRange || 'all'; // '24h' | '7d' | '30d' | 'all'
    const country = req.query.country || 'all';
    const merchant = req.query.merchant || 'all';
    const hygiene = req.query.hygiene || 'all'; // 'missing_image' | 'missing_mrp' | 'missing_price' | 'abnormal_mrp' | 'healthy' | 'all'
    const sort = req.query.sort || 'newest';

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
        { cleanUrl: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    // Time horizon filter
    if (timeRange === '24h') {
      filter.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    } else if (timeRange === '7d') {
      filter.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeRange === '30d') {
      filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    // Country filter
    if (country !== 'all') {
      filter.country = country;
    }

    // Merchant filter
    if (merchant !== 'all') {
      filter.merchant = { $regex: new RegExp(`^${merchant}$`, 'i') };
    }

    // Quality Hygiene filter
    if (hygiene === 'missing_image') {
      filter.$or = [
        { images: { $size: 0 } },
        { images: { $exists: false } },
        { imageUrl: null },
        { imageUrl: '' },
      ];
    } else if (hygiene === 'missing_mrp') {
      filter.$or = [
        { originalPrice: null },
        { originalPrice: { $exists: false } },
        { originalPrice: { $lte: 0 } },
      ];
    } else if (hygiene === 'missing_price') {
      filter.$or = [
        { price: null },
        { price: { $exists: false } },
        { price: { $lte: 0 } },
      ];
    } else if (hygiene === 'abnormal_mrp' || hygiene === 'mrp_gap_2k') {
      filter.originalPrice = { $exists: true, $ne: null, $gt: 0 };
      filter.price = { $exists: true, $ne: null, $gt: 0 };
      filter.$expr = { $gt: [{ $subtract: ['$originalPrice', '$price'] }, 2000] };
    } else if (hygiene === 'healthy') {
      filter.imageUrl = { $exists: true, $ne: '' };
      filter.price = { $gt: 0 };
      filter.originalPrice = { $gt: 0 };
    }

    // Sort order
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    else if (sort === 'price_desc') sortObj = { price: -1 };
    else if (sort === 'price_asc') sortObj = { price: 1 };
    else if (sort === 'last_checked') sortObj = { lastChecked: -1 };

    const skip = (page - 1) * limit;
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
    ]);

    // Check which products currently have an active deal
    const productIds = products.map((p) => p.productId).filter(Boolean);
    const cleanUrls = products.map((p) => p.cleanUrl).filter(Boolean);
    const activeDeals = await Deal.find({
      $or: [{ productId: { $in: productIds } }, { dealUrl: { $in: cleanUrls } }],
      isExpired: { $ne: true },
    }).select('productId dealUrl dealPrice discountPercentage coupon').lean();

    const dealsMap = {};
    activeDeals.forEach((d) => {
      if (d.productId) dealsMap[d.productId] = d;
      if (d.dealUrl) dealsMap[d.dealUrl] = d;
    });

    const enrichedProducts = products.map((p) => ({
      ...p,
      hasDeal: !!(dealsMap[p.productId] || dealsMap[p.cleanUrl]),
      activeDeal: dealsMap[p.productId] || dealsMap[p.cleanUrl] || null,
    }));

    res.json({
      success: true,
      products: enrichedProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a Product (Audit / Edit capabilities)
router.patch('/products/:id', async (req, res) => {
  try {
    const { title, price, originalPrice, category, subcategory, imageUrl, images } = req.body;
    const updateFields = {};

    if (title !== undefined) updateFields.title = title.trim();
    if (price !== undefined) updateFields.price = parseFloat(price) || 0;
    if (originalPrice !== undefined) updateFields.originalPrice = parseFloat(originalPrice) || 0;
    if (category !== undefined) updateFields.category = category.trim().toLowerCase();
    if (subcategory !== undefined) updateFields.subcategory = subcategory.trim();
    if (imageUrl !== undefined) {
      updateFields.imageUrl = imageUrl.trim();
      if (!images || images.length === 0) updateFields.images = [imageUrl.trim()];
    }
    if (Array.isArray(images) && images.length > 0) {
      updateFields.images = images;
      if (!imageUrl) updateFields.imageUrl = images[0];
    }

    updateFields.lastChecked = new Date();

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Synchronize linked Deals if price/MRP/title/image changed
    const dealUpdates = {};
    if (updateFields.title) dealUpdates.title = updateFields.title;
    if (updateFields.price) dealUpdates.dealPrice = updateFields.price;
    if (updateFields.originalPrice) dealUpdates.originalPrice = updateFields.originalPrice;
    if (updateFields.imageUrl) dealUpdates.imageUrl = updateFields.imageUrl;
    if (updateFields.images) dealUpdates.images = updateFields.images;
    if (updateFields.category) dealUpdates.category = updateFields.category;

    if (product.price && product.originalPrice && product.originalPrice > product.price) {
      dealUpdates.discountPercentage = Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      );
    }

    if (Object.keys(dealUpdates).length > 0) {
      await Deal.updateMany(
        { $or: [{ productId: product.productId }, { dealUrl: product.cleanUrl }] },
        { $set: dealUpdates }
      );
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a Product permanently (along with its linked Deals)
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Delete associated deals
    const deleteDealsResult = await Deal.deleteMany({
      $or: [{ productId: product.productId }, { dealUrl: product.cleanUrl }],
    });

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      deletedProductId: req.params.id,
      deletedDealsCount: deleteDealsResult.deletedCount || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deals', async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 }).limit(20);
    res.json({ deals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('savedDeals')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a user (name, email, phoneNumber)
router.patch('/users/:id', async (req, res) => {
  try {
    const { name, email, phoneNumber } = req.body;
    const allowedUpdates = {};
    if (name !== undefined) allowedUpdates.name = name.trim();
    if (email !== undefined) allowedUpdates.email = email.trim().toLowerCase();
    if (phoneNumber !== undefined) allowedUpdates.phoneNumber = phoneNumber.trim();

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a user permanently
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get 24-hour product refresh health and cycle metrics
router.get('/refresh-status', async (req, res) => {
  try {
    const status = await getRefresherStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger an immediate manual refresh batch
router.post('/refresh-batch', async (req, res) => {
  try {
    const batchSize = parseInt(req.body.batchSize || '10', 10);
    const result = await refreshStaleProductBatch(batchSize);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bestseller Crawler admin/config/status endpoints moved to routes/crawler.js
// (mounted at /api/crawler) — DB-backed seeds + admin-controlled frequency, replacing this
// file's old hardcoded CATEGORY_SEEDS + fixed maxCategories trigger.

// Live backend logs — reads from Redis circular list written by every service
// (api, listener, and each scraper-N worker — see utils/systemLogger.js's `source` param).
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 3000);
    const level = req.query.level || 'all'; // 'all' | 'info' | 'warn' | 'error'
    const source = req.query.source || 'all'; // 'all' | 'api' | 'listener' | 'shoppersdeals-scraper-1' | ...
    const since = req.query.since ? new Date(req.query.since) : null;

    // Fetch the whole circular list (capped at 3000 by systemLogger.js) rather than a
    // limit-scaled slice — `sources` below needs to see everything currently retained to
    // report which workers actually have log history right now, not just whatever fits
    // within this one request's limit.
    const raw = await defaultRedis.lrange('logs:backend', 0, -1);
    const all = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);

    const sources = [...new Set(all.map(e => e.source).filter(Boolean))].sort();

    let entries = all;
    if (level !== 'all') entries = entries.filter(e => e.level === level);
    if (source !== 'all') entries = entries.filter(e => e.source === source);
    if (since) entries = entries.filter(e => new Date(e.ts) > since);

    // Return oldest-first so admin can append new lines at the bottom
    entries.reverse();
    if (entries.length > limit) entries = entries.slice(entries.length - limit);

    res.json({ logs: entries, count: entries.length, sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scraper worker fleet status — pings each known scraper-N service's health-check
// endpoint directly (they don't share a DB row or registry; the URL list is the only
// thing identifying them) so the admin panel can show "N / 5 online" and per-worker
// latency without depending on BullMQ's own (less reliable — see the confirmed-live
// eviction incident) internal bookkeeping.
const SCRAPER_WORKER_URLS = [
  'https://shoppersdeals-scraper-1.onrender.com',
  'https://shoppersdeals-scraper-2.onrender.com',
  'https://shoppersdeals-scraper-3.onrender.com',
  'https://shoppersdeals-scraper-4.onrender.com',
  'https://shoppersdeals-scraper-5.onrender.com',
];

router.get('/scrapers/status', async (req, res) => {
  const results = await Promise.all(
    SCRAPER_WORKER_URLS.map(async (url) => {
      const name = url.match(/https:\/\/([^.]+)\.onrender\.com/)?.[1] || url;
      const start = Date.now();
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return { name, url, online: r.ok, latencyMs: Date.now() - start };
      } catch (err) {
        return { name, url, online: false, latencyMs: Date.now() - start, error: err.message };
      }
    })
  );
  res.json({
    total: results.length,
    online: results.filter(r => r.online).length,
    workers: results,
  });
});

// Redis health/memory diagnostic — built during the 2026-08-30 memory-leak incident
// (bull:scraper-queue:events was silently eating 96% of the Redis budget; see
// scraperQueue.js's streams.events.maxLen comment for the full writeup) and kept
// permanently rather than deleted: with another scraper worker planned, this is the
// fastest way to check "is anything ballooning again" without re-deriving the diagnosis
// from scratch. Read-only, admin-auth-protected.
router.get('/redis-debug', async (req, res) => {
  try {
    const infoRaw = await defaultRedis.info('memory');
    const info = {};
    infoRaw.split('\r\n').forEach(line => {
      if (!line || line.startsWith('#')) return;
      const [k, v] = line.split(':');
      if (k) info[k] = v;
    });

    const dbsize = await defaultRedis.dbsize();

    // Sample the keyspace (capped at 2000 keys so this can't itself become a slow/expensive
    // scan on a busy instance) and rank by MEMORY USAGE — the actual per-key footprint.
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await defaultRedis.scan(cursor, 'COUNT', 500);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0' && keys.length < 2000);

    const sized = await Promise.all(
      keys.slice(0, 2000).map(async (key) => {
        try {
          const [bytes, type] = await Promise.all([
            defaultRedis.memory('USAGE', key),
            defaultRedis.type(key),
          ]);
          let extra = null;
          if (type === 'list') extra = await defaultRedis.llen(key).catch(() => null);
          else if (type === 'hash') extra = await defaultRedis.hlen(key).catch(() => null);
          else if (type === 'zset') extra = await defaultRedis.zcard(key).catch(() => null);
          else if (type === 'set') extra = await defaultRedis.scard(key).catch(() => null);
          return { key, type, bytes: bytes || 0, length: extra };
        } catch {
          return { key, type: 'unknown', bytes: 0, length: null };
        }
      })
    );

    sized.sort((a, b) => b.bytes - a.bytes);

    res.json({
      usedMemoryHuman: info.used_memory_human,
      usedMemoryBytes: parseInt(info.used_memory || '0', 10),
      maxmemoryHuman: info.maxmemory_human,
      fragmentationRatio: info.mem_fragmentation_ratio,
      dbsize,
      keysScanned: keys.length,
      topKeysByMemory: sized.slice(0, 25),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/scraping-frequency
 *
 * Global scraping frequency analytics:
 *   - total scrapes per day/week/month by source and merchant
 *   - token consumption breakdown
 *   - over/under-scraped product distribution
 *
 * Query params:
 *   days=30  (default 30, max 90)
 */
router.get('/scraping-frequency', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      bySourceDay,
      byMerchantDay,
      byStatus,
      topProducts,
      bottomProducts,
      tokenConsumption,
      overallStats,
    ] = await Promise.all([
      // Scrapes per source per day
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
              source: '$source',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),

      // Scrapes per merchant per day
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
              merchant: '$merchant',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),

      // Success / error breakdown
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Most-scraped products (potential over-scraping)
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$url',
            totalScrapes: { $sum: 1 },
            merchant: { $first: '$merchant' },
            lastScraped: { $max: '$createdAt' },
            sources: { $addToSet: '$source' },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          },
        },
        { $sort: { totalScrapes: -1 } },
        { $limit: 20 },
        // Lookup product title
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'cleanUrl',
            as: 'product',
            pipeline: [{ $project: { title: 1, price: 1 } }],
          },
        },
        {
          $project: {
            url: '$_id',
            totalScrapes: 1,
            merchant: 1,
            lastScraped: 1,
            sources: 1,
            successCount: 1,
            successRate: { $round: [{ $multiply: [{ $divide: ['$successCount', '$totalScrapes'] }, 100] }, 0] },
            title: { $ifNull: [{ $arrayElemAt: ['$product.title', 0] }, null] },
            price: { $ifNull: [{ $arrayElemAt: ['$product.price', 0] }, null] },
            avgPerDay: { $round: [{ $divide: ['$totalScrapes', days] }, 2] },
          },
        },
      ]),

      // Least-recently scraped active products (under-scraped / stale)
      Product.find(
        { isActive: { $ne: false } },
        { title: 1, merchant: 1, cleanUrl: 1, price: 1, lastChecked: 1 }
      )
        .sort({ lastChecked: 1 })
        .limit(20)
        .lean()
        .then((products) =>
          products.map((p) => ({
            ...p,
            daysSinceLastScrape: p.lastChecked
              ? Math.floor((Date.now() - new Date(p.lastChecked)) / 86400000)
              : null,
          }))
        ),

      // Token consumption by token/account
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since }, tokenUsed: { $ne: null } } },
        {
          $group: {
            _id: '$tokenUsed',
            count: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Overall stats
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalScrapes: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            avgDurationMs: { $avg: '$durationMs' },
            uniqueUrls: { $addToSet: '$url' },
          },
        },
        {
          $project: {
            totalScrapes: 1,
            successCount: 1,
            avgDurationMs: { $round: ['$avgDurationMs', 0] },
            uniqueProductsScraped: { $size: '$uniqueUrls' },
            successRate: { $round: [{ $multiply: [{ $divide: ['$successCount', '$totalScrapes'] }, 100] }, 1] },
          },
        },
      ]).then((r) => r[0] || {}),
    ]);

    // ── Frequency Distribution ──────────────────────────────────────────────
    // Compute per-product scrape frequency (avg/day) and bucket them.
    // Buckets: rare (<0.5/day), daily (~0.5–1.5/day), frequent (1.5–3/day), very_frequent (3+/day)
    const freqDistributionRaw = await ScrapingLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$url',
          totalScrapes: { $sum: 1 },
          merchant: { $first: '$merchant' },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          sources: { $addToSet: '$source' },
          lastScraped: { $max: '$createdAt' },
        },
      },
      // Look up product info (category, title)
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'cleanUrl',
          as: 'product',
          pipeline: [{ $project: { title: 1, category: 1, variant: 1 } }],
        },
      },
      {
        $project: {
          totalScrapes: 1,
          merchant: 1,
          successCount: 1,
          sources: 1,
          lastScraped: 1,
          avgPerDay: { $divide: ['$totalScrapes', days] },
          title: { $ifNull: [{ $arrayElemAt: ['$product.title', 0] }, null] },
          category: { $ifNull: [{ $arrayElemAt: ['$product.category', 0] }, 'uncategorised'] },
        },
      },
    ]);

    // Assign frequency bucket
    function freqBucket(avgPerDay) {
      if (avgPerDay < 0.3) return 'rare';           // less than once every 3 days
      if (avgPerDay < 0.75) return 'every_few_days'; // roughly every 2nd day
      if (avgPerDay < 1.5) return 'daily';           // once a day
      if (avgPerDay < 3) return 'frequent';           // 2× a day
      return 'very_frequent';                         // 3+× a day
    }

    const BUCKET_LABEL = {
      rare: '< every 3d',
      every_few_days: 'Every 2–3 days',
      daily: '~1× / day',
      frequent: '2× / day',
      very_frequent: '3+× / day',
    };

    // Aggregate into buckets
    const buckets = {};
    for (const p of freqDistributionRaw) {
      const bucket = freqBucket(p.avgPerDay);
      if (!buckets[bucket]) {
        buckets[bucket] = { bucket, label: BUCKET_LABEL[bucket], count: 0, byMerchant: {}, byCategory: {}, bySources: {}, examples: [] };
      }
      const b = buckets[bucket];
      b.count++;
      b.byMerchant[p.merchant] = (b.byMerchant[p.merchant] || 0) + 1;
      const cat = (p.category || 'uncategorised').toString().split('>').pop().trim().toLowerCase() || 'uncategorised';
      b.byCategory[cat] = (b.byCategory[cat] || 0) + 1;
      for (const src of (p.sources || [])) b.bySources[src] = (b.bySources[src] || 0) + 1;
      if (b.examples.length < 5) {
        b.examples.push({ url: p._id, title: p.title, merchant: p.merchant, avgPerDay: Math.round(p.avgPerDay * 100) / 100, totalScrapes: p.totalScrapes });
      }
    }

    // Sort each bucket's category/merchant by count desc, top 10
    const frequencyDistribution = ['very_frequent', 'frequent', 'daily', 'every_few_days', 'rare']
      .filter((k) => buckets[k])
      .map((k) => {
        const b = buckets[k];
        return {
          ...b,
          byMerchant: Object.entries(b.byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m, c]) => ({ merchant: m, count: c })),
          byCategory: Object.entries(b.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => ({ category: c, count: n })),
          bySources: Object.entries(b.bySources).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ source: s, count: c })),
        };
      });

    // ── Restructure daily data ──────────────────────────────────────────────
    const dateMap = {};
    for (const row of bySourceDay) {
      const d = row._id.date;
      if (!dateMap[d]) dateMap[d] = { date: d };
      dateMap[d][row._id.source] = row.count;
    }
    const dailyBySource = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    const merchantDateMap = {};
    for (const row of byMerchantDay) {
      const d = row._id.date;
      if (!merchantDateMap[d]) merchantDateMap[d] = { date: d };
      merchantDateMap[d][row._id.merchant] = row.count;
    }
    const dailyByMerchant = Object.values(merchantDateMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      days,
      overview: {
        ...overallStats,
        avgScrapesPerDay: overallStats.totalScrapes ? Math.round(overallStats.totalScrapes / days) : 0,
      },
      byStatus,
      dailyBySource,
      dailyByMerchant,
      frequencyDistribution,  // NEW: products grouped by scraping frequency
      topProducts,            // most-scraped (potential over-scraping)
      bottomProducts,         // stale / under-scraped active products
      tokenConsumption,
    });
  } catch (err) {
    console.error('[Admin] scraping-frequency error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/scraping-frequency/product?url=...&productId=...
 *
 * Per-product scraping frequency — full history breakdown for one product.
 */
router.get('/scraping-frequency/product', async (req, res) => {
  try {
    const { url, productId } = req.query;
    if (!url && !productId) {
      return res.status(400).json({ success: false, error: 'url or productId required' });
    }

    // Find product
    let product = null;
    if (productId) {
      product = await Product.findOne(
        { $or: [{ productId }, { cleanUrl: { $regex: productId } }] },
        { title: 1, merchant: 1, cleanUrl: 1, price: 1, originalPrice: 1, lastChecked: 1 }
      ).lean();
    }
    if (!product && url) {
      product = await Product.findOne(
        { cleanUrl: url },
        { title: 1, merchant: 1, cleanUrl: 1, price: 1, originalPrice: 1, lastChecked: 1 }
      ).lean();
    }
    const targetUrl = url || product?.cleanUrl;
    if (!targetUrl) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const [logs, dailyBreakdown, sourceBreakdown] = await Promise.all([
      // Last 50 scrape events
      ScrapingLog.find({ url: targetUrl })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('source status durationMs createdAt extractedData errorMessage mode')
        .lean(),

      // Daily count over last 30 days
      ScrapingLog.aggregate([
        { $match: { url: targetUrl, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
            count: { $sum: 1 },
            sources: { $addToSet: '$source' },
            statuses: { $addToSet: '$status' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Source breakdown
      ScrapingLog.aggregate([
        { $match: { url: targetUrl } },
        { $group: { _id: '$source', count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const totalScrapes = logs.length > 0
      ? await ScrapingLog.countDocuments({ url: targetUrl })
      : 0;
    const successCount = await ScrapingLog.countDocuments({ url: targetUrl, status: 'success' });

    res.json({
      success: true,
      product: product || { cleanUrl: targetUrl },
      stats: {
        totalScrapes,
        successCount,
        successRate: totalScrapes > 0 ? Math.round((successCount / totalScrapes) * 100) : 0,
        firstSeen: logs.length > 0 ? logs[logs.length - 1]?.createdAt : null,
        lastSeen: logs[0]?.createdAt || null,
      },
      recentLogs: logs,
      dailyBreakdown,
      sourceBreakdown,
    });
  } catch (err) {
    console.error('[Admin] scraping-frequency/product error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
