import express from 'express';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import CrawlerConfig from '../db/models/crawlerConfig.js';
import Product from '../db/models/product.js';
import {
  runCategoryBestsellerCrawl,
  ensureCrawlerDefaults,
  buildAmazonSearchUrl,
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

    res.json({
      success: true,
      config,
      totalSeeds,
      enabledSeeds,
      totalEnrolled,
      categoryCounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update schedule: how often (hours) and whether it's on at all. Takes effect on the scheduler's
// next 5-minute tick — see startBestsellerCrawlerScheduler()'s docblock.
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

// List every keyword seed (all categories/subcategories the crawler watches).
router.get('/seeds', async (req, res) => {
  try {
    await ensureCrawlerDefaults();
    const seeds = await CrawlerSeed.find({}).sort({ category: 1, subcategory: 1 }).lean();
    res.json({ success: true, seeds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a new keyword seed — e.g. an admin wants to track a subcategory Master doesn't have yet,
// or a second, narrower keyword within an existing subcategory.
router.post('/seeds', async (req, res) => {
  try {
    const { category, subcategory, keywords, topN, store, frequencyHours } = req.body;
    if (!category || !subcategory || !keywords) {
      return res.status(400).json({ success: false, error: 'category, subcategory, and keywords are required.' });
    }
    const seed = await CrawlerSeed.create({
      store: store || 'amazon',
      category,
      subcategory,
      keywords,
      url: buildAmazonSearchUrl(keywords),
      topN: topN ? Math.max(1, Math.min(60, parseInt(topN, 10))) : 20,
      isEnabled: true,
      frequencyHours: frequencyHours ? Math.max(1, Math.min(168, parseInt(frequencyHours, 10))) : undefined,
    });
    res.json({ success: true, seed });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: `A seed for ${req.body.category}/${req.body.subcategory} already exists.` });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit a seed's keywords/topN/enabled state. Editing `keywords` regenerates `url` so the two
// never drift apart.
router.put('/seeds/:id', async (req, res) => {
  try {
    const update = {};
    if (req.body.keywords !== undefined) {
      update.keywords = req.body.keywords;
      update.url = buildAmazonSearchUrl(req.body.keywords);
    }
    if (req.body.topN !== undefined) update.topN = Math.max(1, Math.min(60, parseInt(req.body.topN, 10)));
    if (req.body.frequencyHours !== undefined) update.frequencyHours = Math.max(1, Math.min(168, parseInt(req.body.frequencyHours, 10)));
    if (req.body.isEnabled !== undefined) update.isEnabled = !!req.body.isEnabled;
    if (req.body.category !== undefined) update.category = req.body.category;
    if (req.body.subcategory !== undefined) update.subcategory = req.body.subcategory;

    const seed = await CrawlerSeed.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!seed) return res.status(404).json({ success: false, error: 'Seed not found.' });
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

// Manual trigger — either the full enabled-seed sweep, or (with seedIds) just specific rows,
// e.g. the admin panel's per-row "Run now" action.
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

export default router;
