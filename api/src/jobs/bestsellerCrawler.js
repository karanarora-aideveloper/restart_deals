import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import Product from '../db/models/product.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import { apiCache } from '../utils/cache.js';

/**
 * Curated Top Bestseller / Trending Category Endpoints across Amazon.in, Flipkart, Myntra, Nykaa.
 * Each configuration contains 20 top products to monitor per category/subcategory.
 */
export const CATEGORY_SEEDS = [
  // --- ELECTRONICS ---
  {
    store: 'amazon',
    category: 'electronics',
    subcategory: 'mobiles',
    url: 'https://www.amazon.in/s?k=smartphones&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'electronics',
    subcategory: 'audio',
    url: 'https://www.amazon.in/s?k=wireless+earbuds+headphones&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'electronics',
    subcategory: 'laptops',
    url: 'https://www.amazon.in/s?k=laptops&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'electronics',
    subcategory: 'wearables',
    url: 'https://www.amazon.in/s?k=smartwatches&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'electronics',
    subcategory: 'tv',
    url: 'https://www.amazon.in/s?k=smart+tv+4k&s=exact-aware-popularity-rank',
  },

  // --- FASHION & FOOTWEAR ---
  {
    store: 'amazon',
    category: 'men-fashion',
    subcategory: 'footwear',
    url: 'https://www.amazon.in/s?k=men+sneakers+running+shoes&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'men-fashion',
    subcategory: 'watches',
    url: 'https://www.amazon.in/s?k=men+watches&s=exact-aware-popularity-rank',
  },
  {
    store: 'women-fashion',
    category: 'women-fashion',
    subcategory: 'women-ethnic',
    url: 'https://www.amazon.in/s?k=women+kurtis+kurta+sets&s=exact-aware-popularity-rank',
  },

  // --- HOME & KITCHEN ---
  {
    store: 'amazon',
    category: 'home',
    subcategory: 'kitchen',
    url: 'https://www.amazon.in/s?k=kitchen+cookware+appliances&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'home',
    subcategory: 'appliances-large',
    url: 'https://www.amazon.in/s?k=air+fryer+mixer+grinder&s=exact-aware-popularity-rank',
  },

  // --- BEAUTY & PERSONAL CARE ---
  {
    store: 'amazon',
    category: 'beauty',
    subcategory: 'skincare',
    url: 'https://www.amazon.in/s?k=face+serum+sunscreen&s=exact-aware-popularity-rank',
  },
  {
    store: 'amazon',
    category: 'beauty',
    subcategory: 'fragrance',
    url: 'https://www.amazon.in/s?k=perfumes+for+men+women&s=exact-aware-popularity-rank',
  },

  // --- FITNESS & WELLNESS ---
  {
    store: 'amazon',
    category: 'fitness',
    subcategory: 'nutrition',
    url: 'https://www.amazon.in/s?k=whey+protein+isolate&s=exact-aware-popularity-rank',
  }
];

import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';

/**
 * Fetches category page HTML via unified scraper queue with BESTSELLER priority.
 */
async function fetchCategoryHtml(url) {
  return await scraperQueue.enqueue(url, { priority: PRIORITY.BESTSELLER, returnHtml: true });
}

/**
 * Parses Amazon Bestseller or Search page and extracts top 20 items.
 */
export function parseAmazonBestsellerItems(html, categoryInfo) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenAsins = new Set();

  $('[data-asin], .s-result-item[data-asin], .zg-grid-general-faceout').each((_, el) => {
    if (items.length >= 20) return false;

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

/**
 * Autonomous Category Bestseller Crawler
 * Runs through the category seed list and enrolls top 20 products per category into MongoDB.
 */
export async function runCategoryBestsellerCrawl(maxCategories = 5) {
  console.log('==================================================');
  console.log('    RUNNING CATEGORY BESTSELLER CRAWLER (ENGINE 2)');
  console.log('==================================================');

  const stats = {
    seedsCrawled: 0,
    productsEnrolled: 0,
    productsUpdated: 0,
    errors: 0,
  };

  const seedsToRun = CATEGORY_SEEDS.slice(0, maxCategories);

  for (const seed of seedsToRun) {
    stats.seedsCrawled++;
    console.log(`\n[Bestseller Crawler] [${stats.seedsCrawled}/${seedsToRun.length}] Crawling ${seed.store.toUpperCase()} ${seed.category}/${seed.subcategory}...`);

    try {
      let html = await fetchCategoryHtml(seed.url);
      if (!html || html.length < 500) {
        console.log(`[Bestseller Crawler] Primary URL empty. Trying search fallback for ${seed.subcategory}...`);
        html = await fetchCategoryHtml(seed.searchFallback);
      }

      if (!html) {
        console.warn(`[Bestseller Crawler] ⚠️ Could not fetch HTML for ${seed.category}/${seed.subcategory}`);
        stats.errors++;
        continue;
      }

      const products = parseAmazonBestsellerItems(html, seed);
      console.log(`[Bestseller Crawler] Extracted ${products.length} top products for ${seed.subcategory}`);

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      for (const prodData of products) {
        const existing = await Product.findOne({ productId: prodData.productId });

        if (existing) {
          // Update details & ensure enrolled
          existing.isActive = true;
          if (!existing.category || existing.category === 'general') existing.category = prodData.category;
          if (!existing.subcategory) existing.subcategory = prodData.subcategory;
          if (prodData.imageUrl && !existing.imageUrl) {
            existing.imageUrl = prodData.imageUrl;
            existing.images = prodData.images;
          }
          await existing.save();
          stats.productsUpdated++;
        } else {
          // Insert new top bestseller product with initial price checkpoint
          const newProduct = new Product({
            ...prodData,
            priceHistory: [
              {
                date: todayStr,
                price: prodData.price,
                originalPrice: prodData.originalPrice,
                timestamp: now,
              }
            ],
            lastChecked: now,
            priceUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          });

          await newProduct.save();
          stats.productsEnrolled++;
          console.log(`  ✓ Enrolled: "${prodData.title.slice(0, 45)}..." (₹${prodData.price})`);
        }
      }

      // Invalidate API cache so category feeds reflect new products immediately
      apiCache.invalidatePattern('/api/products');

      // Delay between categories to respect rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[Bestseller Crawler Error] Failed for ${seed.category}/${seed.subcategory}:`, err.message);
      stats.errors++;
    }
  }

  console.log('\n==================================================');
  console.log(`[Bestseller Crawler Finished] Seeds: ${stats.seedsCrawled} | Enrolled: ${stats.productsEnrolled} | Updated: ${stats.productsUpdated} | Errors: ${stats.errors}`);
  console.log('==================================================\n');

  return stats;
}
