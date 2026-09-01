import cron from 'node-cron';
import * as cheerio from 'cheerio';
import Product from '../db/models/product.js';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import CrawlerConfig from '../db/models/crawlerConfig.js';
import { apiCache } from '../utils/cache.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';

/**
 * Default keyword seed for every Master subcategory (category pairing taken from each
 * subcategory's real `metadata.parentCategory`, confirmed live against the Master collection —
 * NOT guessed from label text). This only ever runs once, the first time the app boots against
 * an empty crawler_seeds collection (see ensureDefaultSeeds()) — after that, the admin panel
 * (Settings → Bestseller Crawler) owns keywords/frequency/enabled state entirely; editing this
 * list again does nothing for an existing install.
 *
 * `general` here matches an existing quirk, not a new one: eight subcategories (groceries,
 * baby-toys, books-stationery, pet-supplies, office, auto, musical, gifts) already point at a
 * `general` parent category throughout this codebase (see verifier.js's CATEGORY_KEYWORDS) even
 * though `general` itself isn't in Master's active `type:'category'` list — a pre-existing
 * taxonomy gap, not something introduced here.
 */
const DEFAULT_SEEDS = [
  // electronics
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops' },
  { category: 'electronics', subcategory: 'audio', keywords: 'wireless earbuds headphones' },
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k' },
  { category: 'electronics', subcategory: 'cameras', keywords: 'dslr mirrorless camera' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches' },
  { category: 'electronics', subcategory: 'gaming', keywords: 'gaming console controller' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'mobile phone case charger cable' },
  // men-fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts shirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sneakers running shoes' },
  { category: 'men-fashion', subcategory: 'kids', keywords: 'boys clothing' },
  { category: 'men-fashion', subcategory: 'bags', keywords: 'men wallets bags' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men watches' },
  { category: 'men-fashion', subcategory: 'innerwear', keywords: 'men innerwear briefs' },
  // women-fashion
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtis kurta sets' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops jeans' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'women jewellery earrings necklace' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women sandals heels' },
  { category: 'women-fashion', subcategory: 'women-watches', keywords: 'women watches' },
  { category: 'women-fashion', subcategory: 'women-bags', keywords: 'women handbags' },
  { category: 'women-fashion', subcategory: 'women-innerwear', keywords: 'women innerwear lingerie' },
  { category: 'women-fashion', subcategory: 'girls-fashion', keywords: 'girls clothing dresses' },
  // beauty
  { category: 'beauty', subcategory: 'makeup', keywords: 'makeup kit lipstick foundation' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face serum sunscreen moisturizer' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'shampoo conditioner hair oil' },
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body wash lotion soap' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'perfumes for men women' },
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'trimmer shaver men grooming kit' },
  { category: 'beauty', subcategory: 'appliances', keywords: 'hair dryer straightener beauty appliance' },
  { category: 'beauty', subcategory: 'nailcare', keywords: 'nail polish manicure kit' },
  // home
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen cookware appliances' },
  { category: 'home', subcategory: 'furniture', keywords: 'sofa dining table furniture' },
  { category: 'home', subcategory: 'decor', keywords: 'home decor wall art showpiece' },
  { category: 'home', subcategory: 'bedding', keywords: 'bedsheet pillow blanket' },
  { category: 'home', subcategory: 'storage', keywords: 'storage box organizer' },
  { category: 'home', subcategory: 'cleaning', keywords: 'cleaning supplies mop detergent' },
  { category: 'home', subcategory: 'appliances-large', keywords: 'air fryer mixer grinder' },
  { category: 'home', subcategory: 'tools', keywords: 'drill screwdriver tool kit' },
  // fitness
  { category: 'fitness', subcategory: 'gym-equipment', keywords: 'dumbbell treadmill gym equipment' },
  { category: 'fitness', subcategory: 'yoga', keywords: 'yoga mat accessories' },
  { category: 'fitness', subcategory: 'sports-gear', keywords: 'cricket badminton sports gear' },
  { category: 'fitness', subcategory: 'nutrition', keywords: 'whey protein isolate supplements' },
  { category: 'fitness', subcategory: 'apparel', keywords: 'gym wear fitness apparel' },
  { category: 'fitness', subcategory: 'trackers', keywords: 'fitness band tracker' },
  // general (see DEFAULT_SEEDS docblock re: the pre-existing 'general' taxonomy gap)
  { category: 'general', subcategory: 'groceries', keywords: 'grocery gourmet snacks' },
  { category: 'general', subcategory: 'baby-toys', keywords: 'kids toys baby products' },
  { category: 'general', subcategory: 'books-stationery', keywords: 'books notebooks stationery' },
  { category: 'general', subcategory: 'pet-supplies', keywords: 'dog cat pet supplies' },
  { category: 'general', subcategory: 'office', keywords: 'office supplies organizer' },
  { category: 'general', subcategory: 'auto', keywords: 'car bike accessories' },
  { category: 'general', subcategory: 'musical', keywords: 'guitar keyboard musical instruments' },
  { category: 'general', subcategory: 'gifts', keywords: 'gift sets hampers' },
];

/** Amazon.in search URL for a keyword string, ranked by popularity (their bestseller-ish sort). */
export function buildAmazonSearchUrl(keywords) {
  return `https://www.amazon.in/s?k=${encodeURIComponent(keywords)}&s=exact-aware-popularity-rank`;
}

/**
 * One-time bootstrap: populate crawler_seeds from DEFAULT_SEEDS if the collection is empty, and
 * ensure the singleton crawler_config document exists. Safe to call on every boot — both are
 * no-ops once real data/admin edits exist.
 */
export async function ensureCrawlerDefaults() {
  const existingCount = await CrawlerSeed.countDocuments({});
  if (existingCount === 0) {
    console.log(`[Bestseller Crawler] No seeds configured yet — bootstrapping ${DEFAULT_SEEDS.length} default keyword seeds...`);
    await CrawlerSeed.insertMany(
      DEFAULT_SEEDS.map(s => ({
        store: 'amazon',
        category: s.category,
        subcategory: s.subcategory,
        keywords: s.keywords,
        url: buildAmazonSearchUrl(s.keywords),
        topN: 20,
        isEnabled: true,
      })),
      { ordered: false }
    ).catch(err => console.warn('[Bestseller Crawler] Seed bootstrap had some duplicates (harmless):', err.message));
  }

  const config = await CrawlerConfig.findOne({});
  if (!config) {
    console.log('[Bestseller Crawler] No config found — creating default (every 24h, enabled).');
    await CrawlerConfig.create({ isEnabled: true, intervalHours: 24 });
  }

  // Backfill for seeds that predate the frequencyHours field (schema default only applies to
  // NEW documents/saves, not to already-stored rows read back via find/lean) — without this,
  // the $expr due-check in runCategoryBestsellerCrawl() below would compare against a missing
  // field for every pre-existing seed. Idempotent and cheap (only touches rows missing it).
  await CrawlerSeed.updateMany(
    { frequencyHours: { $exists: false } },
    { $set: { frequencyHours: (config || {}).intervalHours || 24 } }
  ).catch(err => console.warn('[Bestseller Crawler] frequencyHours backfill failed (non-fatal):', err.message));
}

/** Fetches a search page's HTML via the shared scraper queue, at the lowest (Bestseller) priority. */
async function fetchCategoryHtml(url) {
  return await scraperQueue.enqueue(url, { priority: PRIORITY.BESTSELLER });
}

/**
 * Parses an Amazon search/bestseller page and extracts the top `topN` ranked items.
 */
export function parseAmazonBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenAsins = new Set();

  $('[data-asin], .s-result-item[data-asin], .zg-grid-general-faceout').each((_, el) => {
    if (items.length >= topN) return false;

    const asin = $(el).attr('data-asin') || $(el).find('[data-asin]').attr('data-asin');
    if (!asin || asin.length < 5 || seenAsins.has(asin)) return;

    // Title
    const title = $(el).find('h2 span, h2 a, ._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y, ._cDEzb_p13n-sc-css-line-clamp-2_EW2cb, .a-size-medium, .a-size-base-plus').first().text().trim();
    if (!title || title.length < 3) return;

    // Price
    const priceText = $(el).find('.a-price .a-offscreen, ._cDEzb_p13n-sc-price_3mJ9Z, .a-price-whole').first().text().trim();
    const cleanPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));
    if (!cleanPrice || isNaN(cleanPrice) || cleanPrice <= 0) return;

    // MRP / Original Price
    const mrpText = $(el).find('.a-text-price .a-offscreen, .a-size-small.a-color-secondary').first().text().trim();
    const cleanMrp = parseFloat(mrpText.replace(/[^\d.]/g, ''));
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    // Image URL
    const imageUrl = $(el).find('img.s-image, img._cDEzb_p13n-sc-dynamic-image_1zBhg, img').first().attr('src') || $(el).find('img').first().attr('data-src');

    // Rating
    const ratingText = $(el).find('.a-icon-alt').first().text().trim();
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.2;

    seenAsins.add(asin);
    items.push({
      productId: asin,
      merchant: 'amazon',
      cleanUrl: `https://www.amazon.in/dp/${asin}`,
      title,
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

let isCrawling = false;

/**
 * Crawls a single seed: fetch its search page via the shared scraper queue, extract top-N
 * products, upsert each into the catalog. Split out from runCategoryBestsellerCrawl() so seeds
 * can be dispatched CONCURRENTLY (see below) instead of one at a time — fetchCategoryHtml()
 * blocks on scraperQueue.enqueue(), which itself blocks on ONE BullMQ job finishing, so running
 * this sequentially for N seeds meant only ONE of the 5 scraper workers was ever busy on this
 * engine's traffic at a time, no matter how many workers existed. Running many of these calls
 * concurrently lets BullMQ's own priority queue + distributed rate limiter fan them out across
 * however many scraper-N workers are actually online — genuinely tying this engine's throughput
 * to worker count, the way it always should have.
 */
async function crawlOneSeed(seed, stats) {
  console.log(`[Bestseller Crawler] Crawling ${seed.store.toUpperCase()} ${seed.category}/${seed.subcategory} ("${seed.keywords}")...`);

  const seedResult = { found: 0, enrolled: 0, updated: 0, error: null };
  try {
    const html = await fetchCategoryHtml(seed.url);
    if (!html) {
      console.warn(`[Bestseller Crawler] ⚠️ Could not fetch HTML for ${seed.category}/${seed.subcategory}`);
      stats.errors++;
      seedResult.error = 'No HTML returned from scraper queue';
    } else {
      const products = parseAmazonBestsellerItems(html, seed, seed.topN || 20);
      seedResult.found = products.length;
      console.log(`[Bestseller Crawler] Extracted ${products.length} top products for ${seed.subcategory}`);

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      for (const prodData of products) {
        const existing = await Product.findOne({ productId: prodData.productId });

        if (existing) {
          existing.isActive = true;
          if (!existing.category || existing.category === 'general') existing.category = prodData.category;
          if (!existing.subcategory) existing.subcategory = prodData.subcategory;
          if (prodData.imageUrl && !existing.imageUrl) {
            existing.imageUrl = prodData.imageUrl;
            existing.images = prodData.images;
          }
          await existing.save();
          stats.productsUpdated++;
          seedResult.updated++;
        } else {
          const newProduct = new Product({
            ...prodData,
            priceHistory: [{ date: todayStr, price: prodData.price, originalPrice: prodData.originalPrice, timestamp: now }],
            lastChecked: now,
            priceUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          await newProduct.save();
          stats.productsEnrolled++;
          seedResult.enrolled++;
          console.log(`  ✓ Enrolled: "${prodData.title.slice(0, 45)}..." (₹${prodData.price})`);
        }
      }

      apiCache.invalidatePattern('/api/products');
    }
  } catch (err) {
    console.error(`[Bestseller Crawler Error] Failed for ${seed.category}/${seed.subcategory}:`, err.message);
    stats.errors++;
    seedResult.error = err.message;
  }

  stats.seedsCrawled++;
  await CrawlerSeed.updateOne({ _id: seed._id }, { lastRunAt: new Date(), lastResult: seedResult }).catch(() => {});
}

/**
 * Runs seeds from the DB (admin-controlled — Settings → Bestseller Crawler) and enrolls/updates
 * their top-N ranked products into the "products" collection. Seeds are dispatched concurrently
 * (see crawlOneSeed's docblock) — actual throughput is governed by the shared scraper queue's
 * worker count and rate limiter, not by this function.
 * @param {{ seedIds?: string[], dueOnly?: boolean }} options
 *   - seedIds: run only these specific seeds (e.g. admin panel's per-row "Run this one now"),
 *     ignoring dueOnly — an explicit manual trigger always runs regardless of frequency.
 *   - dueOnly: only crawl enabled seeds whose OWN frequencyHours has actually elapsed since
 *     their lastRunAt (or that have never run) — used by the scheduler tick below. Omit (or
 *     seedIds without dueOnly) to run every enabled seed regardless of cadence, e.g. the admin's
 *     manual "Run Now (all enabled seeds)" button.
 */
export async function runCategoryBestsellerCrawl(options = {}) {
  if (isCrawling) {
    console.log('[Bestseller Crawler] A crawl is already in progress. Skipping this trigger.');
    return { skipped: true, reason: 'already_running' };
  }
  isCrawling = true;
  const startedAt = Date.now();

  console.log('==================================================');
  console.log('    RUNNING CATEGORY BESTSELLER CRAWLER (ENGINE 2)');
  console.log('==================================================');

  const stats = { seedsCrawled: 0, productsEnrolled: 0, productsUpdated: 0, errors: 0 };

  try {
    await ensureCrawlerDefaults();
    await CrawlerConfig.updateOne({}, { isRunning: true }, { upsert: true });

    const filter = { isEnabled: true };
    if (options.seedIds && options.seedIds.length > 0) {
      filter._id = { $in: options.seedIds };
    } else if (options.dueOnly) {
      // Per-seed due-check at the Mongo level: no lastRunAt yet, OR more hours have passed
      // since lastRunAt than that seed's own frequencyHours calls for. $expr is required here
      // since the comparison is between two fields on the SAME document, not against a fixed
      // value — a plain filter object can't express "field A vs field B * 3600000".
      filter.$expr = {
        $or: [
          { $eq: ['$lastRunAt', null] },
          {
            $gte: [
              { $subtract: [new Date(), '$lastRunAt'] },
              { $multiply: ['$frequencyHours', 60 * 60 * 1000] },
            ],
          },
        ],
      };
    }
    const seeds = await CrawlerSeed.find(filter).lean();

    if (seeds.length === 0) {
      console.log('[Bestseller Crawler] No seeds due right now.');
    } else {
      console.log(`[Bestseller Crawler] Dispatching ${seeds.length} seed(s) concurrently...`);
      // allSettled, not all — one seed's scrape failing (network blip, Amazon block) must not
      // abort every other seed's already-in-flight job.
      await Promise.allSettled(seeds.map(seed => crawlOneSeed(seed, stats)));
    }
  } finally {
    const durationMs = Date.now() - startedAt;
    const now = new Date();
    // Informational "next run due" for the admin dashboard card — the earliest any ENABLED
    // seed will next become due, computed from each seed's own lastRunAt + frequencyHours (not
    // a single global interval any more, since due-ness is now per-seed).
    const nextDueSeed = await CrawlerSeed.aggregate([
      { $match: { isEnabled: true } },
      {
        $addFields: {
          dueAt: {
            $cond: [
              { $eq: ['$lastRunAt', null] },
              now,
              { $add: ['$lastRunAt', { $multiply: ['$frequencyHours', 60 * 60 * 1000] }] },
            ],
          },
        },
      },
      { $sort: { dueAt: 1 } },
      { $limit: 1 },
    ]).catch(() => []);
    const nextRunAt = nextDueSeed[0]?.dueAt || null;

    await CrawlerConfig.updateOne(
      {},
      {
        isRunning: false,
        lastRunAt: now,
        lastRunStats: { ...stats, durationMs },
        nextRunAt,
      },
      { upsert: true }
    ).catch(() => {});
    isCrawling = false;
  }

  console.log('\n==================================================');
  console.log(`[Bestseller Crawler Finished] Seeds: ${stats.seedsCrawled} | Enrolled: ${stats.productsEnrolled} | Updated: ${stats.productsUpdated} | Errors: ${stats.errors}`);
  console.log('==================================================\n');

  return stats;
}

/**
 * Starts the scheduler tick. Ticks every 5 minutes and asks runCategoryBestsellerCrawl to run
 * only whichever seeds are actually due (dueOnly: true — see that function's per-seed $expr
 * check against each seed's own frequencyHours). This used to gate on ONE global
 * CrawlerConfig.nextRunAt and, when due, crawl EVERY enabled seed together on the same cadence
 * — a keyword that turns over daily got the same schedule as one that barely changes. Now each
 * keyword's own frequency (editable per-seed in Settings → Bestseller Crawler) decides when
 * it's due; a 5-minute tick just means "due" is noticed within 5 minutes of actually becoming
 * true, not that everything runs every 5 minutes. Call once from server startup.
 */
export function startBestsellerCrawlerScheduler() {
  console.log('[Bestseller Crawler] Initializing scheduler (checks every 5 minutes for seeds due by their own frequency)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      await ensureCrawlerDefaults();
      const config = await CrawlerConfig.findOne({});
      if (!config || !config.isEnabled) return;

      if (config.isRunning) {
        // Stale-lock self-heal: isRunning is set true right before a crawl starts and cleared
        // in the finally block when it finishes — but a deploy/restart that kills the process
        // mid-crawl (this API service redeploys often) skips that finally block entirely,
        // leaving isRunning stuck true in the DB forever. Confirmed live: found this flag
        // stuck true with updatedAt two days stale, silently skipping every 5-minute tick that
        // whole time — the scheduler was doing nothing. updatedAt is bumped by the same
        // updateOne() that sets isRunning: true, so it doubles as "when did the current run
        // start" without needing a new field. A real concurrent run (even a large due batch
        // fanned across the worker fleet) has no business taking anywhere near 60 minutes, so
        // treat anything older than that as abandoned and recover instead of staying stuck.
        const runningForMs = Date.now() - new Date(config.updatedAt).getTime();
        if (runningForMs < 60 * 60 * 1000) return;
        console.warn(`[Bestseller Crawler] isRunning has been stuck true for ${Math.round(runningForMs / 60000)}m — treating as an abandoned lock from an interrupted run and clearing it.`);
        await CrawlerConfig.updateOne({}, { isRunning: false });
      }

      await runCategoryBestsellerCrawl({ dueOnly: true });
    } catch (err) {
      console.error('[Bestseller Crawler Scheduler Error]:', err.message);
    }
  });

  // First-boot bootstrap so the admin panel has something to show immediately, without waiting
  // up to 5 minutes for the first tick.
  setTimeout(() => {
    ensureCrawlerDefaults().catch(err => console.error('[Bestseller Crawler] Default bootstrap failed:', err.message));
  }, 5000);
}
