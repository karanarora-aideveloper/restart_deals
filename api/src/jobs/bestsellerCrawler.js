import cron from 'node-cron';
import * as cheerio from 'cheerio';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import CrawlerConfig from '../db/models/crawlerConfig.js';
import { apiCache } from '../utils/cache.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';
import { classifyProduct } from '../utils/categoryClassifier.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';

/**
 * Multi-Store Search URL Builder
 * Generates store-specific search/listing URLs ranked by popularity/relevance.
 */
export function buildStoreSearchUrl(store = 'amazon', keywords = '') {
  const enc = encodeURIComponent(keywords.trim());
  const cleanStore = (store || 'amazon').toLowerCase().trim();
  switch (cleanStore) {
    case 'flipkart':
      return `https://www.flipkart.com/search?q=${enc}&sort=popularity`;
    case 'nykaa':
      return `https://www.nykaa.com/search/result/?q=${enc}&sort=popularity`;
    case 'myntra':
      return `https://www.myntra.com/${encodeURIComponent(keywords.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))}?sort=popularity`;
    case 'meesho':
      return `https://www.meesho.com/search?q=${enc}`;
    case 'ajio':
      return `https://www.ajio.com/search/?text=${enc}`;
    case 'croma':
      return `https://www.croma.com/searchB?q=${enc}%3Arelevance`;
    case 'amazon':
    default:
      return `https://www.amazon.in/s?k=${enc}&s=exact-aware-popularity-rank`;
  }
}

/** Legacy alias for Amazon search URL builder */
export function buildAmazonSearchUrl(keywords) {
  return buildStoreSearchUrl('amazon', keywords);
}

/**
 * Categorized Default Seeds by Merchant Store
 * - Amazon: General broad marketplace coverage (53 seeds across all categories)
 * - Flipkart: Electronics, Appliances, and High-demand lifestyle (14 seeds)
 * - Nykaa: Curated Beauty, Makeup, Skincare, Haircare, Fragrance & Grooming (12 seeds)
 * - Myntra: Fashion, Footwear, Bags, Watches & Western/Ethnic wear (12 seeds)
 * - Meesho: High-velocity budget ethnic, daily wear, bedding & home value (10 seeds)
 */
export const DEFAULT_AMAZON_SEEDS = [
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
  { category: 'home', subcategory: 'appliances-large', keywords: 'water purifier RO UV' },
  { category: 'home', subcategory: 'tools', keywords: 'drill screwdriver tool kit' },
  // fitness
  { category: 'fitness', subcategory: 'gym-equipment', keywords: 'dumbbell treadmill gym equipment' },
  { category: 'fitness', subcategory: 'yoga', keywords: 'yoga mat accessories' },
  { category: 'fitness', subcategory: 'sports-gear', keywords: 'cricket badminton sports gear' },
  { category: 'fitness', subcategory: 'nutrition', keywords: 'whey protein isolate supplements' },
  { category: 'fitness', subcategory: 'apparel', keywords: 'gym wear fitness apparel' },
  { category: 'fitness', subcategory: 'trackers', keywords: 'fitness band tracker' },
  // general
  { category: 'general', subcategory: 'groceries', keywords: 'grocery gourmet snacks' },
  { category: 'general', subcategory: 'baby-toys', keywords: 'kids toys baby products' },
  { category: 'general', subcategory: 'books-stationery', keywords: 'books notebooks stationery' },
  { category: 'general', subcategory: 'pet-supplies', keywords: 'dog cat pet supplies' },
  { category: 'general', subcategory: 'office', keywords: 'office supplies organizer' },
  { category: 'general', subcategory: 'auto', keywords: 'car bike accessories' },
  { category: 'general', subcategory: 'musical', keywords: 'guitar keyboard musical instruments' },
  { category: 'general', subcategory: 'gifts', keywords: 'gift sets hampers' },
];

export const DEFAULT_FLIPKART_SEEDS = [
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones 5g' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops thin light gaming' },
  { category: 'electronics', subcategory: 'audio', keywords: 'wireless earbuds bluetooth headphones' },
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k 43 55 inch' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches bluetooth calling' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'fast charger power bank' },
  { category: 'home', subcategory: 'kitchen', keywords: 'mixer grinder pressure cooker cookware' },
  { category: 'home', subcategory: 'bedding', keywords: 'cotton double bedsheet' },
  { category: 'home', subcategory: 'appliances-large', keywords: 'washing machine refrigerator microwave' },
  { category: 'home', subcategory: 'appliances-large', keywords: 'water purifier ro uv' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts casual shirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans cotton trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men running shoes sneakers' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtis kurta set saree' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops jeans' },
];

export const DEFAULT_NYKAA_SEEDS = [
  { category: 'beauty', subcategory: 'makeup', keywords: 'fit me foundation compact primer' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'matte liquid lipstick lip gloss' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'kajal eyeliner mascara eyeshadow' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face serum niacinamide vitamin c' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'sunscreen spf 50 moisturizer gel' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face wash cleanser foaming' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'keratin shampoo hair mask serum' },
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body wash shower gel body lotion' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'eau de parfum perfume for women men' },
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'beard oil face wash men grooming' },
  { category: 'beauty', subcategory: 'appliances', keywords: 'hair dryer hair straightener styler' },
  { category: 'beauty', subcategory: 'nailcare', keywords: 'nail polish gel enamel kit' },
];

export const DEFAULT_MYNTRA_SEEDS = [
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men cotton casual shirts polo t-shirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men slim fit stretch jeans cargo trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men running shoes white sneakers loafers' },
  { category: 'men-fashion', subcategory: 'bags', keywords: 'men genuine leather wallet office bag' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men analog chronograph watch' },
  { category: 'men-fashion', subcategory: 'innerwear', keywords: 'men trunks boxers vests cotton' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'anarkali kurti kurta palazzo set' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women maxi dress floral tops high waist jeans' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'oxidised silver earrings necklace sets' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women block heels casual flats wedges' },
  { category: 'women-fashion', subcategory: 'women-bags', keywords: 'women tote bag shoulder sling handbag' },
  { category: 'women-fashion', subcategory: 'women-watches', keywords: 'women analog rose gold watch' },
];

export const DEFAULT_MEESHO_SEEDS = [
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'cotton printed kurti daily wear' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'georgette designer saree ready to wear' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women nighty night dress loungewear' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'traditional oxidised jhumka earrings set' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men combo pack t-shirts regular fit' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men trackpants track pants lower' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men lightweight mesh running sports shoes' },
  { category: 'home', subcategory: 'bedding', keywords: 'fitted elastic double bedsheet with pillow covers' },
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen storage container set spice box organizer' },
  { category: 'home', subcategory: 'decor', keywords: 'curtains for door window home decoration' },
];

export const DEFAULT_AJIO_SEEDS = [
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts shirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sneakers shoes' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men watches' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtas kurtis' },
  { category: 'women-fashion', subcategory: 'footwear', keywords: 'women sandals heels' },
  { category: 'women-fashion', subcategory: 'handbags', keywords: 'women handbags totes' },
  { category: 'men-fashion', subcategory: 'kids', keywords: 'kids wear' },
  { category: 'home', subcategory: 'decor', keywords: 'cushion covers bedsheets curtains' },
];

export const DEFAULT_CROMA_SEEDS = [
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops' },
  { category: 'electronics', subcategory: 'audio', keywords: 'bluetooth earphones headphones soundbar' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches' },
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'air fryer microwave mixer grinder' },
  { category: 'appliances', subcategory: 'large-appliances', keywords: 'washing machine refrigerator air conditioner' },
  { category: 'personal-care', subcategory: 'grooming', keywords: 'trimmer hair dryer straightener' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'power bank mobile charger cable' },
];

export const DEFAULT_SEEDS_BY_STORE = {
  amazon: DEFAULT_AMAZON_SEEDS,
  flipkart: DEFAULT_FLIPKART_SEEDS,
  nykaa: DEFAULT_NYKAA_SEEDS,
  myntra: DEFAULT_MYNTRA_SEEDS,
  meesho: DEFAULT_MEESHO_SEEDS,
  ajio: DEFAULT_AJIO_SEEDS,
  croma: DEFAULT_CROMA_SEEDS,
};

/** Helper to clean raw price strings into safe numbers */
function cleanPriceVal(val) {
  if (val == null) return null;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

/**
 * One-time bootstrap: populate crawler_seeds across all 5 stores if missing.
 */
export async function ensureCrawlerDefaults() {
  for (const [store, seedList] of Object.entries(DEFAULT_SEEDS_BY_STORE)) {
    const existingStoreCount = await CrawlerSeed.countDocuments({ store });
    if (existingStoreCount === 0) {
      console.log(`[Shoppers Deals Engine] Bootstrapping ${seedList.length} default keyword seeds for ${store.toUpperCase()}...`);
      const docs = seedList.map(s => ({
        store,
        category: s.category,
        subcategory: s.subcategory,
        keywords: s.keywords,
        url: buildStoreSearchUrl(store, s.keywords),
        topN: 20,
        isEnabled: true,
        frequencyHours: 24,
      }));
      await CrawlerSeed.insertMany(docs, { ordered: false }).catch(err => {
        console.warn(`[Shoppers Deals Engine] Seed bootstrap for ${store} had duplicate items (harmless):`, err.message);
      });
    }
  }

  const config = await CrawlerConfig.findOne({});
  if (!config) {
    console.log('[Shoppers Deals Engine] No config found — creating default (every 24h, enabled).');
    await CrawlerConfig.create({ isEnabled: true, intervalHours: 24 });
  }

  await CrawlerSeed.updateMany(
    { frequencyHours: { $exists: false } },
    { $set: { frequencyHours: (config || {}).intervalHours || 24 } }
  ).catch(() => {});
}

/** Fetches a search page's HTML via the shared scraper queue at BESTSELLER priority. */
async function fetchCategoryHtml(url) {
  return await scraperQueue.enqueue(url, { priority: PRIORITY.BESTSELLER });
}

/**
 * Refines the category/subcategory of a scraped search result by its title.
 * Prevents sponsored or related accessories, smartwatches, and audio devices from
 * blindly inheriting a seed's category (e.g. powerbanks appearing under 'mobiles').
 */
export function refineCategoryFromTitle(title, seedCategory, seedSubcategory) {
  if (!title) return { category: seedCategory, subcategory: seedSubcategory };
  const t = title.trim();

  // Try high precision classifier first
  const highPrecision = classifyProduct(t);
  if (highPrecision) {
    // If the classified category is a clear correction (e.g. accessories/wearables found in mobiles, or travel bags found in fashion)
    if (seedCategory === 'electronics' || seedSubcategory === 'mobiles' || seedSubcategory === 'laptops') {
      if (highPrecision.category === 'electronics' || highPrecision.category === 'travel' || highPrecision.category === 'home') {
        return highPrecision;
      }
    }
    if (seedCategory === 'men-fashion' || seedCategory === 'women-fashion') {
      if (highPrecision.category === 'travel' || highPrecision.category === 'personal-care' || highPrecision.category === 'baby-kids' || highPrecision.category === 'auto') {
        return highPrecision;
      }
    }
  }

  // If seed is in electronics or mobiles, protect against powerbanks, smartwatches, audio, accessories
  if (seedCategory === 'electronics' || seedSubcategory === 'mobiles') {
    if (/\b(power ?bank|powerbank|energyshroom)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'accessories' };
    }
    if (/\b(smartwatch|smart watch|fitness band|smart band|smart ring|redmi watch|oneplus watch|galaxy watch|apple watch)\b/i.test(t) || (/\bwatch\b/i.test(t) && !/\b(phone|mobile|smartphone)\b/i.test(t))) {
      return { category: 'electronics', subcategory: 'wearables' };
    }
    if (/\b(earbuds?|tws\b|headphones?|earphones?|neckbands?|bluetooth speaker|\bspeaker\b|soundbar)\b/i.test(t) && !/\b(iphone 1[1-7]|galaxy s2[0-6]|mobile phone|smartphone)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'audio' };
    }
    if (/\b(case for|cover for|\bcase\b|\bcover\b|screen protector|tempered glass|mobile holder|phone stand|tablet stand|car mount|phone mount|phone grip|popsocket|charger|charging cable|usb-c cable|lightning cable|usb cable|type-c cable|adapter)\b/i.test(t)) {
      const isRealKidTablet = /\b(toddler tablet|kids tablet|children tablet)\b/i.test(t) && /\b(wifi|android|32gb|64gb)\b/i.test(t);
      if (!isRealKidTablet) {
        return { category: 'electronics', subcategory: 'accessories' };
      }
    }
    if (/\b(tripod|selfie stick|gimbal|photo printer)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'cameras' };
    }
    if (/\b(gamepad|game controller|mobile controller|phone controller)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'gaming' };
    }
  }

  return { category: seedCategory, subcategory: seedSubcategory };
}

/**
 * Parses an Amazon search/bestseller page and extracts topN items.
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
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    // MRP / Original Price
    const mrpText = $(el).find('.a-text-price .a-offscreen, .a-size-small.a-color-secondary').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    // Image URL
    const imageUrl = $(el).find('img.s-image, img._cDEzb_p13n-sc-dynamic-image_1zBhg, img').first().attr('src') || $(el).find('img').first().attr('data-src');

    // Rating
    const ratingText = $(el).find('.a-icon-alt').first().text().trim();
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.2;

    const refinedCat = refineCategoryFromTitle(title, categoryInfo.category, categoryInfo.subcategory);

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
      category: refinedCat.category,
      subcategory: refinedCat.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Flipkart search/listing page and extracts topN items.
 */
export function parseFlipkartBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  $('div[data-id], a[href*="pid="], a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;

    const $el = $(el);
    let pid = $el.attr('data-id');
    const href = $el.attr('href') || $el.find('a[href*="pid="]').attr('href') || $el.find('a[href*="/p/"]').attr('href');

    if (!pid && href) {
      const pidMatch = href.match(/pid=([A-Z0-9]{16})/i) || href.match(/\/p\/([a-z0-9]{16})/i);
      if (pidMatch) pid = pidMatch[1];
    }

    if (!pid || pid.length < 6 || seenIds.has(pid)) return;

    const card = $el.is('div[data-id]') ? $el : $el.closest('div[data-id], div[class*="_1AtVbE"], div[class*="cPHDOP"]');
    const scope = card.length ? card : $el;

    let title = scope.find('div.KzDlHZ, a.WKTcLC, div._4rR01T, a.IRpwTa, a._2B099V').first().text().trim();
    const brand = scope.find('div._2WkVRV').first().text().trim();
    if (brand && title && !title.toLowerCase().startsWith(brand.toLowerCase())) {
      title = `${brand} ${title}`;
    }
    if (!title) {
      title = scope.find('a[title]').first().attr('title') || scope.find('img').first().attr('alt');
    }
    if (!title || title.length < 3) return;

    const priceText = scope.find('div.Nx9bqj, div._30jeq3, div[class*="Nx9bqj"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('div.yRaY8j, div._3I9_R3, div[class*="yRaY8j"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imageUrl = scope.find('img.DByuf4, img._53G40d, img[src*="flixcart.com"], img[src*="rukminim"], img').first().attr('src');
    const ratingText = scope.find('div._5OesEi span div, div._3LWZlK, div[class*="_3LWZlK"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    const refinedCat = refineCategoryFromTitle(title, categoryInfo.category, categoryInfo.subcategory);

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'flipkart',
      cleanUrl: `https://www.flipkart.com/product/p/itme?pid=${pid}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: refinedCat.category,
      subcategory: refinedCat.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Nykaa search/listing page and extracts topN items.
 */
export function parseNykaaBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Check window.__PRELOADED_STATE__ if present in SSR
  let preloadedProducts = null;
  $('script').each((_, el) => {
    if (preloadedProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__PRELOADED_STATE__');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const candidateList = parsed.productSearch?.products || parsed.search?.products || parsed.products;
          if (Array.isArray(candidateList) && candidateList.length > 0) {
            preloadedProducts = candidateList;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(preloadedProducts) && preloadedProducts.length > 0) {
    for (const p of preloadedProducts) {
      if (items.length >= topN) break;
      const pid = String(p.id || p.productId || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.finalPrice || p.price || p.discountedPrice);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.mrp || p.originalPrice) || price;
      const title = p.title || p.name || '';
      if (!title) continue;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'nykaa',
        cleanUrl: p.slug ? `https://www.nykaa.com/${p.slug.replace(/^\//, '')}/p/${pid}` : `https://www.nykaa.com/product/p/${pid}`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: p.imageUrl || p.image || null,
        images: (p.imageUrl || p.image) ? [p.imageUrl || p.image] : [],
        rating: typeof p.rating === 'number' ? p.rating : 4.3,
        category: categoryInfo.category || 'beauty',
        subcategory: categoryInfo.subcategory || 'makeup',
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM extraction: product cards with /p/ links
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const pidMatch = href.match(/\/p\/(\d+)/i);
    if (!pidMatch) return;
    const pid = pidMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('div[class*="productWrapper"], div.product-card, div[class*="css-"], div');
    const scope = card.length ? card : $a;

    const title = scope.find('[class*="product-title"], [class*="title"], h2, div[class*="css-15vhhhd"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = scope.find('[class*="css-111z9ua"], [class*="price"], .post-discount-price').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('[class*="css-17xsgbl"], [class*="mrp"], [class*="discount"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img[src*="adn-image"], img[src*="nykaa"], img').first();
    let imageUrl = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;
    if (!imageUrl) {
      const srcset = imgEl.attr('srcset');
      if (srcset) {
        const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
        if (parts.length > 0 && parts[0].startsWith('http')) imageUrl = parts[0];
      }
    }
    const ratingText = scope.find('[class*="css-v3h0e"], [class*="rating"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.3;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'nykaa',
      cleanUrl: `https://www.nykaa.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category || 'beauty',
      subcategory: categoryInfo.subcategory || 'makeup',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Myntra search/listing page and extracts topN items.
 */
export function parseMyntraBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Try window.__myx script first
  let myxProducts = null;
  $('script').each((_, el) => {
    if (myxProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__myx');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const candidateList = parsed.searchData?.results?.products || parsed.pdpData?.products;
          if (Array.isArray(candidateList) && candidateList.length > 0) {
            myxProducts = candidateList;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(myxProducts) && myxProducts.length > 0) {
    for (const p of myxProducts) {
      if (items.length >= topN) break;
      const pid = String(p.productId || p.id || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.price);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.mrp) || price;
      const title = `${p.brand || ''} ${p.additionalInfo || p.productName || p.product || ''}`.trim();
      if (!title) continue;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'myntra',
        cleanUrl: p.landingPageUrl ? `https://www.myntra.com/${p.landingPageUrl.replace(/^\//, '')}` : `https://www.myntra.com/product/${pid}/buy`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: p.searchImage || p.images?.[0]?.src || null,
        images: (p.searchImage || p.images?.[0]?.src) ? [p.searchImage || p.images[0].src] : [],
        rating: typeof p.rating === 'number' ? Math.round(p.rating * 10) / 10 : 4.2,
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM fallback
  $('li.product-base, div.product-base, a[href*="/buy"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $el = $(el);
    const href = $el.attr('href') || $el.find('a[href*="/buy"]').attr('href') || '';
    const idMatch = href.match(/\/(\d+)\/buy/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const brand = $el.find('.product-brand').first().text().trim();
    const prodName = $el.find('.product-product').first().text().trim();
    const title = `${brand} ${prodName}`.trim() || $el.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = $el.find('.product-discountedPrice, .product-price').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = $el.find('.product-strike').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imageUrl = $el.find('img.product-image, img[src*="myntassets"], img').first().attr('src');
    const ratingText = $el.find('.product-ratingsContainer span').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'myntra',
      cleanUrl: `https://www.myntra.com/${href.replace(/^\//, '')}`,
      title: title.slice(0, 200),
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

/**
 * Parses a Meesho search/listing page and extracts topN items.
 */
export function parseMeeshoBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Check __NEXT_DATA__
  const nextDataScript = $('script#__NEXT_DATA__').contents().text();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const searchProducts = nextData.props?.pageProps?.initialState?.search?.products ||
                             nextData.props?.pageProps?.data?.products ||
                             nextData.props?.pageProps?.products;
      if (Array.isArray(searchProducts) && searchProducts.length > 0) {
        for (const p of searchProducts) {
          if (items.length >= topN) break;
          const pid = String(p.id || p.product_id || p.slug || '');
          if (!pid || seenIds.has(pid)) continue;
          const price = cleanPriceVal(p.discounted_price || p.price || p.min_catalog_price);
          if (!price) continue;
          const originalPrice = cleanPriceVal(p.mrp || p.valid_mrp) || price;
          const title = p.name || p.title || '';
          if (!title) continue;

          seenIds.add(pid);
          items.push({
            productId: pid,
            merchant: 'meesho',
            cleanUrl: p.slug ? `https://www.meesho.com/${p.slug}/p/${pid}` : `https://www.meesho.com/s/p/${pid}`,
            title: title.slice(0, 200),
            price,
            originalPrice,
            imageUrl: p.product_image || p.images?.[0] || null,
            images: (p.product_image || p.images?.[0]) ? [p.product_image || p.images[0]] : [],
            rating: typeof p.rating === 'number' ? Math.round(p.rating * 10) / 10 : 4.0,
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory,
            isActive: true,
            country: 'IN',
          });
        }
        if (items.length > 0) return items;
      }
    } catch {}
  }

  // 2. DOM fallback
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/\/p\/([a-z0-9]+)/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('div[class*="Card"], div[class*="ProductCard"], div');
    const scope = card.length ? card : $a;

    const title = scope.find('h5, p, span[class*="title"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    let cleanPrice = null;
    let cleanMrp = null;
    scope.find('*').each((_, child) => {
      const txt = $(child).text().trim();
      if (/^₹\s*[\d,]+/.test(txt)) {
        const val = cleanPriceVal(txt);
        if (!cleanPrice) cleanPrice = val;
        else if (val && val > cleanPrice) cleanMrp = val;
      }
    });

    if (!cleanPrice) return;
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;
    const imageUrl = scope.find('img[src*="meesho"], img').first().attr('src');

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'meesho',
      cleanUrl: `https://www.meesho.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating: 4.0,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses an Ajio search/listing page and extracts topN items.
 */
export function parseAjioBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Try window.__PRELOADED_STATE__ script first
  let ajioProducts = null;
  $('script').each((_, el) => {
    if (ajioProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__PRELOADED_STATE__');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const grid = parsed.grid?.entities || parsed.search?.products || parsed.gridData?.products;
          if (Array.isArray(grid) && grid.length > 0) {
            ajioProducts = grid;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(ajioProducts) && ajioProducts.length > 0) {
    for (const p of ajioProducts) {
      if (items.length >= topN) break;
      const pid = String(p.code || p.fnlColorVariantData?.outfitCode || p.id || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.price?.value || p.discountedPrice || p.price);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.wasPriceData?.value || p.mrp || p.originalPrice) || price;
      const title = `${p.brandName || ''} ${p.name || ''}`.trim() || p.name || '';
      if (!title) continue;

      const imgUrl = p.images?.[0]?.url || p.fnlColorVariantData?.galleryImages?.[0]?.url || null;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'ajio',
        cleanUrl: p.url ? (p.url.startsWith('http') ? p.url : `https://www.ajio.com${p.url}`) : `https://www.ajio.com/p/${pid}`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: imgUrl,
        images: imgUrl ? [imgUrl] : [],
        rating: 4.2,
        category: categoryInfo.category || 'men-fashion',
        subcategory: categoryInfo.subcategory || 'men-topwear',
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM fallback
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/\/p\/([a-z0-9_]+)/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('.item, div[aria-label*="product"], div.rilrtl-products-list__item, div[class*="product"]');
    const scope = card.length ? card : $a;

    const brand = scope.find('div.brand, .brand').first().text().trim();
    const name = scope.find('div.name, .name, [class*="prod-name"]').first().text().trim();
    let title = brand && name ? `${brand} ${name}` : (name || brand || scope.find('img').first().attr('alt'));
    if (!title || title.length < 3) return;

    const priceText = scope.find('span.price, .price, [class*="prod-sp"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('span.orginal-price, [class*="prod-cp"], .orginal-price').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img');
    let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'ajio',
      cleanUrl: `https://www.ajio.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating: 4.2,
      category: categoryInfo.category || 'men-fashion',
      subcategory: categoryInfo.subcategory || 'men-topwear',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Croma search/listing page and extracts topN items.
 */
export function parseCromaBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  $('li.product-item, div.cp-product, div[data-testid="product-card"], a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $el = $(el);
    const $a = $el.is('a[href*="/p/"]') ? $el : $el.find('a[href*="/p/"]').first();
    const href = $a.attr('href') || '';
    const pidMatch = href.match(/\/p\/(\d+)/i) || href.match(/\/p\/([a-z0-9]+)/i);
    if (!pidMatch) return;
    const pid = pidMatch[1];
    if (seenIds.has(pid)) return;

    const scope = $el;
    const title = scope.find('h3.product-title, .product-title a, h3, [class*="productTitle"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = scope.find('span.amount, [data-testid="new-price"], .new-price, [class*="amount"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('span.old-price, [data-testid="old-price"], .old-price, [class*="mrp"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img[src*="croma"], img').first();
    let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;

    const ratingText = scope.find('[class*="rating"], [data-testid="rating"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'croma',
      cleanUrl: href.startsWith('http') ? href.split('?')[0] : `https://www.croma.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category || 'electronics',
      subcategory: categoryInfo.subcategory || 'mobiles',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Universal Store Listing Parser Dispatcher
 */
export function parseStoreListingItems(html, seed, topN = 20) {
  const store = (seed.store || 'amazon').toLowerCase().trim();
  switch (store) {
    case 'flipkart':
      return parseFlipkartBestsellerItems(html, seed, topN);
    case 'nykaa':
      return parseNykaaBestsellerItems(html, seed, topN);
    case 'myntra':
      return parseMyntraBestsellerItems(html, seed, topN);
    case 'meesho':
      return parseMeeshoBestsellerItems(html, seed, topN);
    case 'ajio':
      return parseAjioBestsellerItems(html, seed, topN);
    case 'croma':
      return parseCromaBestsellerItems(html, seed, topN);
    case 'amazon':
    default:
      return parseAmazonBestsellerItems(html, seed, topN);
  }
}

let isCrawling = false;

/**
 * Crawls a single seed: fetch its search page via the shared scraper queue, extract top-N
 * products across supported stores, upsert each into the catalog and synthesize authentic deals.
 */
async function crawlOneSeed(seed, stats) {
  const storeName = (seed.store || 'amazon').toUpperCase();
  console.log(`[Shoppers Deals Engine] Crawling ${storeName} ${seed.category}/${seed.subcategory} ("${seed.keywords}")...`);

  const seedResult = { found: 0, enrolled: 0, updated: 0, error: null };
  try {
    const html = await fetchCategoryHtml(seed.url);
    if (!html) {
      console.warn(`[Shoppers Deals Engine] ⚠️ Could not fetch HTML for ${storeName} ${seed.category}/${seed.subcategory}`);
      stats.errors++;
      seedResult.error = 'No HTML returned from scraper queue';
    } else {
      const products = parseStoreListingItems(html, seed, seed.topN || 20);
      seedResult.found = products.length;
      console.log(`[Shoppers Deals Engine] Extracted ${products.length} top products for ${storeName} ${seed.subcategory}`);

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      for (const prodData of products) {
        const existing = await Product.findOne({ productId: prodData.productId });

        if (existing) {
          existing.isActive = true;
          if (!existing.merchant || existing.merchant === 'unknown') existing.merchant = prodData.merchant;
          if (!existing.category || existing.category === 'general') existing.category = prodData.category;
          if (!existing.subcategory) existing.subcategory = prodData.subcategory;
          if (prodData.imageUrl && !existing.imageUrl) {
            existing.imageUrl = prodData.imageUrl;
            existing.images = prodData.images;
          }
          existing.isTop20 = true;
          existing.top20Category = prodData.category;
          existing.top20Subcategory = prodData.subcategory;
          if (!existing.productSource) existing.productSource = 'top20_catalog';

          // Check for price changes & synthesize deals
          if (prodData.price && prodData.price !== existing.price) {
            const priorPrice = existing.price;
            existing.previousPrice = priorPrice;
            existing.price = prodData.price;
            existing.priceUpdatedAt = now;

            if (!Array.isArray(existing.priceHistory)) existing.priceHistory = [];
            const dayIdx = existing.priceHistory.findIndex(e => e.date === todayStr);
            if (dayIdx >= 0) {
              if (prodData.price < existing.priceHistory[dayIdx].price) {
                existing.priceHistory[dayIdx].price = prodData.price;
                existing.priceHistory[dayIdx].timestamp = now;
              }
            } else {
              existing.priceHistory.push({
                date: todayStr,
                price: prodData.price,
                originalPrice: prodData.originalPrice || existing.originalPrice,
                timestamp: now,
              });
            }
            if (existing.priceHistory.length > 90) {
              existing.priceHistory = existing.priceHistory.slice(-90);
            }

            // Autonomous deal synthesis if qualifies
            if (priorPrice && priorPrice > prodData.price) {
              const genuineDiscount = Math.round(((priorPrice - prodData.price) / priorPrice) * 100);
              const cashDrop = priorPrice - prodData.price;
              const thresholdCheck = meetsCategoryThreshold(existing.category, existing.subcategory, genuineDiscount, cashDrop, 'IN');
              if (thresholdCheck.qualifies) {
                const deal = new Deal({
                  sourceChannelId: 'shoppers_deals_engine',
                  sourceMessageId: `sde_${prodData.productId}_${Date.now()}`,
                  sourceChannelName: 'Shoppers Deals Engine Discovery',
                  originalText: `Autonomous Price Drop Detected on ${existing.merchant.toUpperCase()} ${existing.subcategory}: ${existing.title} at ₹${prodData.price}`,
                  title: existing.title,
                  description: `Autonomous price drop detected via Shoppers Deals Engine (${existing.merchant}). Price dropped from ₹${priorPrice} to ₹${prodData.price}.`,
                  imageUrl: existing.imageUrl || (existing.images && existing.images[0]) || null,
                  images: existing.images || (existing.imageUrl ? [existing.imageUrl] : []),
                  rating: existing.rating || 4.2,
                  dealUrl: existing.cleanUrl,
                  productId: existing.productId,
                  merchant: existing.merchant,
                  originalPrice: existing.originalPrice || prodData.originalPrice,
                  dealPrice: prodData.price,
                  previousPrice: priorPrice,
                  discountPercentage: genuineDiscount,
                  priceSource: 'price_history',
                  category: existing.category || 'general',
                  subcategory: existing.subcategory || '',
                  isVerified: true,
                  isExpired: false,
                  lastVerifiedAt: now,
                  country: 'IN',
                  createdAt: now,
                  updatedAt: now,
                });
                await deal.save();
                apiCache.invalidatePattern('/api/deals');
                enqueueDealForPublishing(deal._id, { sourceEngine: 'shoppers_deals_engine' }).catch(() => {});
                evaluateAndTriggerPriceAlerts({
                  productId: existing.productId,
                  livePrice: prodData.price,
                  title: existing.title,
                  dealUrl: existing.cleanUrl,
                  imageUrl: existing.imageUrl,
                  merchant: existing.merchant,
                  category: existing.category,
                  subcategory: existing.subcategory,
                }).catch(() => {});
              }
            }
          }

          await existing.save();
          stats.productsUpdated++;
          seedResult.updated++;
        } else {
          const newProduct = new Product({
            ...prodData,
            isTop20: true,
            top20Category: prodData.category,
            top20Subcategory: prodData.subcategory,
            productSource: 'top20_catalog',
            priceHistory: [{ date: todayStr, price: prodData.price, originalPrice: prodData.originalPrice, timestamp: now }],
            lastChecked: now,
            priceUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          await newProduct.save();
          stats.productsEnrolled++;
          seedResult.enrolled++;
          console.log(`  ✓ Enrolled [${prodData.merchant.toUpperCase()}]: "${prodData.title.slice(0, 45)}..." (₹${prodData.price})`);
        }
      }

      apiCache.invalidatePattern('/api/products');
    }
  } catch (err) {
    console.error(`[Shoppers Deals Engine Error] Failed for ${storeName} ${seed.category}/${seed.subcategory}:`, err.message);
    stats.errors++;
    seedResult.error = err.message;
  }

  stats.seedsCrawled++;
  await CrawlerSeed.updateOne({ _id: seed._id }, { lastRunAt: new Date(), lastResult: seedResult }).catch(() => {});
}

/**
 * Runs seeds from the DB and enrolls/updates their top-N products.
 */
export async function runCategoryBestsellerCrawl(options = {}) {
  if (isCrawling) {
    console.log('[Shoppers Deals Engine] A crawl is already in progress. Skipping this trigger.');
    return { skipped: true, reason: 'already_running' };
  }

  // Pre-flight check: ensure active ScrapingAnt proxy tokens exist before starting category crawl
  const activeTokens = await ScrapingAntToken.countDocuments({ status: 'active' }).catch(() => 0);
  if (activeTokens === 0) {
    console.log('[Shoppers Deals Engine] ⏸️ 0 active ScrapingAnt tokens. Skipping crawl tick to preserve queue health.');
    return { skipped: true, reason: 'no_active_tokens' };
  }

  isCrawling = true;
  const startedAt = Date.now();

  console.log('==================================================');
  console.log('    RUNNING SHOPPERS DEALS ENGINE (ENGINE 2)');
  console.log('==================================================');

  const stats = { seedsCrawled: 0, productsEnrolled: 0, productsUpdated: 0, errors: 0 };

  try {
    await ensureCrawlerDefaults();
    await CrawlerConfig.updateOne({}, { isRunning: true }, { upsert: true });

    const filter = { isEnabled: true };
    if (options.seedIds && options.seedIds.length > 0) {
      filter._id = { $in: options.seedIds };
    } else if (options.dueOnly) {
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
      console.log('[Shoppers Deals Engine] No seeds due right now.');
    } else {
      console.log(`[Shoppers Deals Engine] Dispatching ${seeds.length} multi-store seed(s) concurrently...`);
      await Promise.allSettled(seeds.map(seed => crawlOneSeed(seed, stats)));
    }
  } finally {
    const durationMs = Date.now() - startedAt;
    const now = new Date();
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
  console.log(`[Shoppers Deals Engine Finished] Seeds: ${stats.seedsCrawled} | Enrolled: ${stats.productsEnrolled} | Updated: ${stats.productsUpdated} | Errors: ${stats.errors}`);
  console.log('==================================================\n');

  return stats;
}

/**
 * Starts the scheduler tick. Ticks every 5 minutes.
 */
export function startBestsellerCrawlerScheduler() {
  console.log('[Shoppers Deals Engine] Initializing scheduler (checks every 5 minutes for seeds due by their own frequency)...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      await ensureCrawlerDefaults();
      const config = await CrawlerConfig.findOne({});
      if (!config || !config.isEnabled) return;

      if (config.isRunning) {
        const runningForMs = Date.now() - new Date(config.updatedAt).getTime();
        if (runningForMs < 60 * 60 * 1000) return;
        console.warn(`[Shoppers Deals Engine] isRunning has been stuck true for ${Math.round(runningForMs / 60000)}m — clearing lock.`);
        await CrawlerConfig.updateOne({}, { isRunning: false });
      }

      await runCategoryBestsellerCrawl({ dueOnly: true });
    } catch (err) {
      console.error('[Shoppers Deals Engine Scheduler Error]:', err.message);
    }
  });

  setTimeout(() => {
    ensureCrawlerDefaults().catch(err => console.error('[Shoppers Deals Engine] Default bootstrap failed:', err.message));
  }, 5000);
}

/**
 * Auto-seed a new keyword into CrawlerSeed when a user searches for something
 * that returns zero results in our catalog.
 */
export async function autoSeedZeroResultQuery(queryText, preferredStore = 'amazon') {
  if (!queryText || typeof queryText !== 'string') return null;
  const clean = queryText.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (clean.length < 3 || clean.length > 60) return null;

  // Filter out pure numbers or generic stopwords
  if (/^\d+$/.test(clean) || ['the', 'and', 'for', 'all', 'deal', 'deals', 'price', 'track', 'product'].includes(clean)) {
    return null;
  }

  try {
    const existing = await CrawlerSeed.findOne({
      store: preferredStore,
      keywords: clean,
    });

    if (existing) {
      return existing;
    }

    const searchUrl = buildStoreSearchUrl(preferredStore, clean);
    const newSeed = await CrawlerSeed.create({
      store: preferredStore,
      category: 'search',
      subcategory: 'user_requested',
      keywords: clean,
      url: searchUrl,
      topN: 20,
      isEnabled: true,
      frequencyHours: 12, // User-requested search keywords crawled with higher priority (12h)
    });

    console.log(`[Crawler Auto-Seed] 🎯 Auto-seeded new keyword from user search miss: "${clean}" (${preferredStore})`);
    return newSeed;
  } catch (err) {
    // Ignore duplicate key collision
    return null;
  }
}
