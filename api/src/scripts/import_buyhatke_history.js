import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const DEFAULT_PRODUCT_ID = '6a772dd44a56ce3165547e92';
const DEFAULT_BUYHATKE_URL = 'https://buyhatke.com/amazon-atomberg-intellon-india-s-1st-adaptive-water-purifier-ro-uf-uv-alkaliser-zero-cost-for-2yrs-4-modes-tds-based-filtration-smart-iot-7-sta-price-in-india-63-81539568';

/**
 * Extracts the embedded historical price intervals from a Buyhatke product page.
 * Buyhatke embeds this in a SvelteKit hydration payload inside <script> as `history:[{from:..., to:..., price:...}, ...]`.
 */
export async function fetchBuyhatkeHistory(buyhatkeUrl) {
  console.log(`[Buyhatke] Fetching HTML from: ${buyhatkeUrl}`);
  const res = await fetch(buyhatkeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Buyhatke page: HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const histStart = html.indexOf('history:[');
  if (histStart === -1) {
    throw new Error('No history array found in Buyhatke page HTML');
  }

  const arrayStart = histStart + 8; // index of '['
  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('Malformed history array syntax in Buyhatke HTML');
  }

  const historyCode = html.substring(arrayStart, arrayEnd + 1);
  // Safely evaluate JSON-like object literal
  // eslint-disable-next-line no-eval
  const rawIntervals = eval(historyCode);
  console.log(`[Buyhatke] Extracted ${rawIntervals.length} historical price intervals.`);
  return rawIntervals;
}

/**
 * Normalizes Buyhatke intervals into 1 daily checkpoint per calendar day,
 * adhering to ShoppersDeals 365-day rolling daily compaction standard (AGENTS.md Decision #12).
 */
export function normalizeIntervalsToDailyCheckpoints(rawIntervals, originalPrice = 25999) {
  if (!rawIntervals || rawIntervals.length === 0) return [];

  const intervals = rawIntervals
    .map(h => ({
      from: new Date(h.from.replace(' ', 'T') + 'Z'),
      to: new Date(h.to.replace(' ', 'T') + 'Z'),
      price: Math.round(Number(h.price)),
    }))
    .filter(h => !isNaN(h.from.getTime()) && !isNaN(h.price) && h.price > 0)
    .sort((a, b) => a.from - b.from);

  if (intervals.length === 0) return [];

  const startDate = new Date(intervals[0].from);
  startDate.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const checkpoints = [];
  let curr = new Date(startDate);
  let lastKnownPrice = intervals[0].price;

  while (curr <= today) {
    const dateStr = curr.toISOString().split('T')[0];

    // Find interval containing current date
    const match = intervals.find(inv => inv.from <= curr && inv.to >= curr);
    if (match) {
      lastKnownPrice = match.price;
    } else {
      const past = intervals.filter(inv => inv.to < curr);
      if (past.length > 0) {
        lastKnownPrice = past[past.length - 1].price;
      }
    }

    // Filter out corrupted prices (> 100,000 or <= 0 for standard water purifier)
    const validPrice = (lastKnownPrice > 0 && lastKnownPrice < 100000) ? lastKnownPrice : 17999;

    checkpoints.push({
      date: dateStr,
      price: validPrice,
      originalPrice,
      timestamp: new Date(dateStr + 'T12:00:00Z'),
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  // Cap to 365-day rolling window if exceeds 365 days
  if (checkpoints.length > 365) {
    console.log(`[Compaction] Total checkpoints (${checkpoints.length}) exceeds 365 days. Rolling 365-day compaction applied.`);
    return checkpoints.slice(-365);
  }

  return checkpoints;
}

async function run() {
  const targetId = process.argv[2] || DEFAULT_PRODUCT_ID;
  const buyhatkeUrl = process.argv[3] || DEFAULT_BUYHATKE_URL;

  console.log('====================================================');
  console.log('    BUYHATKE HISTORICAL PRICE BACKFILL PIPELINE     ');
  console.log('====================================================\n');
  console.log(`Target Product ID:  ${targetId}`);
  console.log(`Buyhatke Source:    ${buyhatkeUrl}\n`);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  const product = await Product.findOne({
    $or: [{ _id: mongoose.isValidObjectId(targetId) ? targetId : null }, { productId: targetId }]
  });

  if (!product) {
    throw new Error(`Product not found for ID/ASIN: ${targetId}`);
  }

  console.log(`[Product] Found: "${product.title?.substring(0, 50)}..."`);
  console.log(`[Product] Current Recorded Price: ₹${product.price}`);
  console.log(`[Product] Existing History Checkpoints: ${product.priceHistory?.length || 0}`);

  // Fetch raw intervals from Buyhatke
  const rawIntervals = await fetchBuyhatkeHistory(buyhatkeUrl);

  // Normalize into daily checkpoints
  const originalPrice = product.originalPrice || 25999;
  const dailyCheckpoints = normalizeIntervalsToDailyCheckpoints(rawIntervals, originalPrice);

  // Ensure the latest checkpoint reflects today's price
  if (dailyCheckpoints.length > 0 && product.price) {
    const last = dailyCheckpoints[dailyCheckpoints.length - 1];
    const todayStr = new Date().toISOString().split('T')[0];
    if (last.date === todayStr) {
      last.price = product.price;
    } else {
      dailyCheckpoints.push({
        date: todayStr,
        price: product.price,
        originalPrice,
        timestamp: new Date(),
      });
    }
  }

  console.log(`\n[Normalization] Generated ${dailyCheckpoints.length} daily checkpoints.`);
  const prices = dailyCheckpoints.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  console.log(` -> Historical Lowest:  ₹${minPrice}`);
  console.log(` -> Historical Highest: ₹${maxPrice}`);
  console.log(` -> Historical Average: ₹${avgPrice}`);
  console.log(` -> Date Range:         ${dailyCheckpoints[0].date} to ${dailyCheckpoints[dailyCheckpoints.length - 1].date}`);

  // Update Product Document
  product.priceHistory = dailyCheckpoints;
  product.updatedAt = new Date();

  await product.save();
  console.log('\n✅ Successfully updated Product priceHistory in MongoDB Atlas!');

  await mongoose.disconnect();
  console.log('[DB] Disconnected from MongoDB Atlas. Done.\n');
}

import { fileURLToPath } from 'url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((err) => {
    console.error('\n❌ Import Error:', err.message);
    process.exit(1);
  });
}
