import express from 'express';
import mongoose from 'mongoose';
import { defaultRedis } from '../utils/redis.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import User from '../db/models/user.js';
import { getRefresherStatus, refreshStaleProductBatch } from '../jobs/dailyProductRefresher.js';

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

// Live backend logs — reads from Redis circular list written by the backend service
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
    const level = req.query.level || 'all'; // 'all' | 'info' | 'warn' | 'error'
    const since = req.query.since ? new Date(req.query.since) : null;

    // LRANGE 0 -1 = all entries; list is newest-first (LPUSH), so reverse for display
    const raw = await defaultRedis.lrange('logs:backend', 0, limit * 3);
    let entries = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);

    if (level !== 'all') entries = entries.filter(e => e.level === level);
    if (since) entries = entries.filter(e => new Date(e.ts) > since);

    // Return oldest-first so admin can append new lines at the bottom
    entries.reverse();
    if (entries.length > limit) entries = entries.slice(entries.length - limit);

    res.json({ logs: entries, count: entries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY — incident diagnostic for the 2026-08-30 Redis memory investigation. Removes
// the guesswork: reports Redis's own INFO memory stats plus the actual largest keys in the
// keyspace right now, since the aggregate memory_usage metric alone can't say WHAT is large.
// Safe to leave mounted (read-only, admin-auth-protected) but should be deleted once the
// investigation concludes — see /architecture's Pipeline Diagram tab or ask Claude for status.
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

export default router;
