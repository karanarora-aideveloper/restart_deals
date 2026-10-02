import express from 'express';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import CrawlerConfig from '../db/models/crawlerConfig.js';
import Product from '../db/models/product.js';
import {
  runCategoryBestsellerCrawl,
  ensureCrawlerDefaults,
  buildStoreSearchUrl,
  buildAmazonSearchUrl,
  autoSeedZeroResultQuery,
} from '../jobs/bestsellerCrawler.js';

const router = express.Router();

// Overall status: config (frequency/enabled/last+next run) + per-category enrolled product
// counts, so the admin panel doesn't need a second round trip to /admin/crawler/status.
router.get('/status', async (req, res) => {
  try {
    await ensureCrawlerDefaults();
    const config = await CrawlerConfig.findOne({}).lean();
    const totalSeeds = await CrawlerSeed.countDocuments({});
    const enabledSeeds = await CrawlerSeed.countDocuments({ isEnabled: true });
    const totalEnrolled = await Product.countDocuments({ isActive: true });
    const categoryCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const storeCounts = await CrawlerSeed.aggregate([
      { $group: { _id: '$store', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
    ]);

    res.json({
      success: true,
      config,
      totalSeeds,
      enabledSeeds,
      totalEnrolled,
      categoryCounts,
      storeCounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update schedule: how often (hours) and whether it's on at all.
router.put('/config', async (req, res) => {
  try {
    const update = {};
    if (req.body.intervalHours !== undefined) {
      const hours = parseInt(req.body.intervalHours, 10);
      if (isNaN(hours) || hours < 1 || hours > 168) {
        return res.status(400).json({ success: false, error: 'intervalHours must be between 1 and 168.' });
      }
      update.intervalHours = hours;
    }
    if (req.body.isEnabled !== undefined) update.isEnabled = !!req.body.isEnabled;

    const config = await CrawlerConfig.findOneAndUpdate({}, update, { upsert: true, new: true });
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List keyword seeds with optional store filter (amazon, flipkart, nykaa, myntra, meesho, all)
router.get('/seeds', async (req, res) => {
  try {
    await ensureCrawlerDefaults();
    const filter = {};
    if (req.query.store && req.query.store !== 'all') {
      filter.store = req.query.store.toLowerCase().trim();
    }
    const seeds = await CrawlerSeed.find(filter).sort({ store: 1, category: 1, subcategory: 1 }).lean();
    res.json({ success: true, seeds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a new keyword seed for any supported merchant store
router.post('/seeds', async (req, res) => {
  try {
    const { category, subcategory, keywords, topN, store, frequencyHours } = req.body;
    if (!category || !subcategory || !keywords) {
      return res.status(400).json({ success: false, error: 'category, subcategory, and keywords are required.' });
    }
    const chosenStore = (store || 'amazon').toLowerCase().trim();
    const seed = await CrawlerSeed.create({
      store: chosenStore,
      category,
      subcategory,
      keywords,
      url: buildStoreSearchUrl(chosenStore, keywords),
      topN: topN ? Math.max(1, Math.min(60, parseInt(topN, 10))) : 20,
      isEnabled: true,
      frequencyHours: frequencyHours ? Math.max(1, Math.min(168, parseInt(frequencyHours, 10))) : undefined,
    });
    res.json({ success: true, seed });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: `A seed for ${req.body.store || 'amazon'} ${req.body.category}/${req.body.subcategory} with these keywords already exists.` });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit a seed's keywords/store/topN/enabled state.
router.put('/seeds/:id', async (req, res) => {
  try {
    const existing = await CrawlerSeed.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Seed not found.' });

    const update = {};
    const targetStore = req.body.store !== undefined ? req.body.store.toLowerCase().trim() : existing.store;
    const targetKeywords = req.body.keywords !== undefined ? req.body.keywords : existing.keywords;

    if (req.body.store !== undefined) update.store = targetStore;
    if (req.body.keywords !== undefined) update.keywords = targetKeywords;
    if (req.body.store !== undefined || req.body.keywords !== undefined) {
      update.url = buildStoreSearchUrl(targetStore, targetKeywords);
    }
    if (req.body.topN !== undefined) update.topN = Math.max(1, Math.min(60, parseInt(req.body.topN, 10)));
    if (req.body.frequencyHours !== undefined) update.frequencyHours = Math.max(1, Math.min(168, parseInt(req.body.frequencyHours, 10)));
    if (req.body.isEnabled !== undefined) update.isEnabled = !!req.body.isEnabled;
    if (req.body.category !== undefined) update.category = req.body.category;
    if (req.body.subcategory !== undefined) update.subcategory = req.body.subcategory;

    const seed = await CrawlerSeed.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, seed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/seeds/:id', async (req, res) => {
  try {
    const seed = await CrawlerSeed.findByIdAndDelete(req.params.id);
    if (!seed) return res.status(404).json({ success: false, error: 'Seed not found.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual trigger — either full sweep or specific seeds
router.post('/run-now', async (req, res) => {
  try {
    const seedIds = Array.isArray(req.body.seedIds) ? req.body.seedIds : undefined;
    runCategoryBestsellerCrawl({ seedIds }).catch(err => {
      console.error('[Admin Crawler Trigger Error]:', err.message);
    });
    res.json({
      success: true,
      message: seedIds ? `Crawl started for ${seedIds.length} seed(s).` : 'Full crawl started across all enabled seeds.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-seed endpoint (called on search misses or via PostHog analytics webhooks)
router.post('/seeds/auto-seed', async (req, res) => {
  try {
    const { query, store = 'amazon' } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query is required.' });
    }

    const seed = await autoSeedZeroResultQuery(query, store);
    res.json({
      success: true,
      seeded: Boolean(seed),
      seed,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
