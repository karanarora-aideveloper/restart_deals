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
 * Runs every currently-enabled seed from the DB (admin-controlled — Settings → Bestseller
 * Crawler) and enrolls/updates its top-N ranked products into the "products" collection.
 * @param {{ seedIds?: string[] }} options - pass seedIds to run only specific seeds (e.g. the
 *   admin panel's per-row "Run this one now"); omit to run every enabled seed.
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
    if (options.seedIds && options.seedIds.length > 0) filter._id = { $in: options.seedIds };
    const seeds = await CrawlerSeed.find(filter).lean();

    for (const seed of seeds) {
      stats.seedsCrawled++;
      console.log(`\n[Bestseller Crawler] [${stats.seedsCrawled}/${seeds.length}] Crawling ${seed.store.toUpperCase()} ${seed.category}/${seed.subcategory} ("${seed.keywords}")...`);

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

      await CrawlerSeed.updateOne({ _id: seed._id }, { lastRunAt: new Date(), lastResult: seedResult }).catch(() => {});

      // Delay between seeds — same courtesy pause the previous version had, independent of the
      // scraper queue's own rate limiting (this is Amazon's search endpoint, not the product
      // page endpoint most of the pipeline hits).
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    const durationMs = Date.now() - startedAt;
    const config = await CrawlerConfig.findOne({}).catch(() => null);
    const intervalHours = config?.intervalHours || 24;
    const now = new Date();
    await CrawlerConfig.updateOne(
      {},
      {
        isRunning: false,
        lastRunAt: now,
        lastRunStats: { ...stats, durationMs },
        nextRunAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
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
 * Starts the scheduler tick. A fixed cron expression can't be changed live from the admin
 * panel, so instead this ticks every 5 minutes and compares `now` against CrawlerConfig's
 * `nextRunAt` — editing "run every N hours" in Settings → Bestseller Crawler takes effect on the
 * very next tick, no redeploy needed. Call once from server startup.
 */
export function startBestsellerCrawlerScheduler() {
  console.log('[Bestseller Crawler] Initializing scheduler (checks every 5 minutes against admin-configured frequency)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      await ensureCrawlerDefaults();
      const config = await CrawlerConfig.findOne({});
      if (!config || !config.isEnabled || config.isRunning) return;

      const due = !config.nextRunAt || new Date() >= new Date(config.nextRunAt);
      if (!due) return;

      console.log('[Bestseller Crawler] Scheduled run is due — starting full crawl across all enabled seeds...');
      await runCategoryBestsellerCrawl();
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
