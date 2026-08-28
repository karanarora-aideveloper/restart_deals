import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/db/models/product.js';

dotenv.config();

function getFormattedDate(d) {
  if (!d) return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

async function cleansePriceHistory() {
  console.log('==================================================');
  console.log('      CLEANSING & NORMALIZING PRICE HISTORIES     ');
  console.log('==================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.');

  const totalProducts = await Product.countDocuments();
  console.log(`[Cleanser] Processing ${totalProducts} products with indexed stream...`);

  const BATCH_SIZE = 500;
  let processedCount = 0;
  let updatedCount = 0;
  let deduplicatedPointsCount = 0;
  let lastId = null;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const products = await Product.find(query)
      .select('_id price originalPrice priceHistory createdAt priceUpdatedAt')
      .sort({ _id: 1 })
      .lean()
      .limit(BATCH_SIZE);

    if (!products || products.length === 0) break;

    const bulkOps = [];

    for (const product of products) {
      lastId = product._id;
      const rawList = Array.isArray(product.priceHistory) ? product.priceHistory : [];
      const canonicalMRP = product.originalPrice || product.price || null;
      let modified = false;
      let normalizedList = [];

      if (rawList.length === 0 && product.price) {
        const now = product.priceUpdatedAt || product.createdAt || new Date();
        const dateStr = getFormattedDate(now);
        normalizedList = [{
          date: dateStr,
          price: Number(product.price),
          originalPrice: canonicalMRP,
          timestamp: now
        }];
        modified = true;
      } else if (rawList.length > 0) {
        const dailyMap = new Map();

        for (const entry of rawList) {
          if (!entry || !entry.price || isNaN(Number(entry.price))) continue;

          const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
          const dateStr = entry.date || getFormattedDate(timestamp);
          const price = Number(entry.price);
          const originalPrice = Number(entry.originalPrice) || canonicalMRP;

          dailyMap.set(dateStr, {
            date: dateStr,
            price,
            originalPrice,
            timestamp
          });
        }

        if (product.price) {
          const todayStr = getFormattedDate(product.priceUpdatedAt || new Date());
          if (!dailyMap.has(todayStr)) {
            dailyMap.set(todayStr, {
              date: todayStr,
              price: Number(product.price),
              originalPrice: canonicalMRP,
              timestamp: product.priceUpdatedAt || new Date()
            });
          }
        }

        normalizedList = Array.from(dailyMap.values())
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (normalizedList.length !== rawList.length || rawList.some(r => !r.date)) {
          if (rawList.length > normalizedList.length) {
            deduplicatedPointsCount += (rawList.length - normalizedList.length);
          }
          modified = true;
        }
      }

      if (modified) {
        bulkOps.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { priceHistory: normalizedList } }
          }
        });
        updatedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    processedCount += products.length;
    console.log(`[Cleanser] Processed ${processedCount}/${totalProducts} (${updatedCount} modified)...`);
  }

  console.log(`\n==================================================`);
  console.log(`  CLEANSING COMPLETE:`);
  console.log(`  • Total Products: ${totalProducts}`);
  console.log(`  • Products Cleansed/Updated: ${updatedCount}`);
  console.log(`  • Redundant Points Deduplicated: ${deduplicatedPointsCount}`);
  console.log(`==================================================`);

  await mongoose.disconnect();
  process.exit(0);
}

cleansePriceHistory().catch(e => {
  console.error('Fatal cleanser error:', e);
  process.exit(1);
});
