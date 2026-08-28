import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import { parseProductUrl } from '../utils/urlParser.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { computePriceStats } from '../utils/priceAnalytics.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testLookupFlow() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.');

  const testUrl = 'https://www.amazon.in/dp/B0GPM1V9C5';
  console.log(`[Test] Looking up URL: ${testUrl}`);

  const parsed = parseProductUrl(testUrl);
  let product = await Product.findOne({ productId: parsed.productId });

  if (!product) {
    console.log('[Test] Product not found in DB. Live scraping...');
    const scraped = await scrapeProductUrl(parsed.cleanUrl);
    if (scraped && scraped.title) {
      const now = new Date();
      product = new Product({
        productId: parsed.productId,
        cleanUrl: parsed.cleanUrl,
        merchant: parsed.merchant,
        title: scraped.title,
        imageUrl: scraped.imageUrl,
        images: scraped.images,
        rating: scraped.rating,
        price: scraped.price,
        originalPrice: scraped.originalPrice,
        category: scraped.category,
        priceSource: 'scraped',
        priceUpdatedAt: now,
        priceHistory: [{
          price: scraped.price,
          originalPrice: scraped.originalPrice,
          timestamp: now
        }],
        lastChecked: now
      });
      await product.save();
      console.log('[Test] Successfully created new product!');
    }
  }

  const productObj = product.toObject();
  const stats = computePriceStats(productObj);
  console.log('\n[Price Analytics & Verdict Result]:', {
    title: productObj.title,
    currentPrice: `₹${productObj.price}`,
    originalPrice: `₹${productObj.originalPrice}`,
    lowestPrice: `₹${stats.lowestPrice}`,
    highestPrice: `₹${stats.highestPrice}`,
    verdict: stats.verdictTitle,
    reason: stats.verdictReason
  });

  await mongoose.disconnect();
  process.exit(0);
}

testLookupFlow().catch(e => {
  console.error(e);
  process.exit(1);
});
