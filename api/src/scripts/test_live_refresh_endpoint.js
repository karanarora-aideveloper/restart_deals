import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { computePriceStats } from '../utils/priceAnalytics.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testLiveRefresh() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.');

  // Find a product with Amazon URL
  const product = await Product.findOne({ cleanUrl: /amazon\.in\/dp/ });
  if (!product) {
    console.log('No Amazon product found to test.');
    await mongoose.disconnect();
    return;
  }

  console.log(`[Test] Testing Live Price Refresh for "${product.title}" (${product.cleanUrl})...`);
  console.log(`[Test] Current DB Price: ₹${product.price}`);

  const scraped = await scrapeProductUrl(product.cleanUrl);
  console.log(`[Test] Live Scraped Price: ₹${scraped?.price || 'N/A'}`);

  if (scraped && scraped.price) {
    const livePrice = scraped.price;
    const now = new Date();
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (!product.priceHistory) product.priceHistory = [];
    const todayIdx = product.priceHistory.findIndex(h => h.date === todayStr);
    if (todayIdx >= 0) {
      product.priceHistory[todayIdx].price = livePrice;
      product.priceHistory[todayIdx].date = todayStr;
      product.priceHistory[todayIdx].timestamp = now;
    } else {
      product.priceHistory.push({
        date: todayStr,
        price: livePrice,
        originalPrice: product.originalPrice || livePrice,
        timestamp: now
      });
    }

    product.price = livePrice;
    product.lastChecked = now;
    await product.save();
    console.log(`[Test] ✓ Live price checkpoint updated successfully to ₹${livePrice}!`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

testLiveRefresh().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
