import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function fixCurrencyAndTtl() {
  console.log('='.repeat(70));
  console.log('    FIX: MULTI-CURRENCY ASIN ISOLATION & TTL LOG EXPIRY');
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('[DB] Connected to MongoDB Atlas.\n');

  // -------------------------------------------------------------
  // 1. Drop old single-field unique index productId_1 on products
  //    and create compound unique index on { productId: 1, country: 1 }
  // -------------------------------------------------------------
  console.log('🔧 [1/5] Updating MongoDB indexes for country isolation...');
  try {
    const productIndexes = await db.collection('products').indexes();
    const hasSingleUniquePid = productIndexes.some(i => i.name === 'productId_1' && i.unique);
    if (hasSingleUniquePid) {
      console.log('   Dropping old single-field unique index: productId_1');
      await db.collection('products').dropIndex('productId_1');
    }
  } catch (err) {
    console.warn('   Note on dropping productId_1:', err.message);
  }

  try {
    console.log('   Creating compound unique index: { productId: 1, country: 1 }');
    await db.collection('products').createIndex(
      { productId: 1, country: 1 },
      { unique: true, background: true, name: 'productId_1_country_1' }
    );
    console.log('   ✅ Compound unique index created successfully.');
  } catch (err) {
    console.warn('   Note on creating productId_1_country_1:', err.message);
  }

  // -------------------------------------------------------------
  // 2. Clean up contaminated US Products (INR MRP / Swapped Price)
  // -------------------------------------------------------------
  console.log('\n🔧 [2/5] Sanitizing contaminated US products (USD vs INR)...');
  const contaminatedUsProducts = await Product.find({
    country: 'US',
    $or: [
      { originalPrice: { $gt: 2000 } },
      { 'priceHistory.originalPrice': { $gt: 2000 } },
      { 'priceHistory.price': { $gt: 2000 } }
    ]
  });
  console.log(`   Found ${contaminatedUsProducts.length} contaminated US products.`);

  let sanitizedCount = 0;
  for (const p of contaminatedUsProducts) {
    // Filter out priceHistory entries with INR prices (> 2000)
    if (p.priceHistory && p.priceHistory.length > 0) {
      p.priceHistory = p.priceHistory.filter(ph => (ph.price || 0) <= 2000 && (ph.originalPrice || 0) <= 2000);
    }

    // Reset originalPrice if it was INR
    if (p.originalPrice && p.originalPrice > 2000) {
      // Find highest reasonable USD price from history or match price
      let validMax = p.price || 0;
      for (const ph of p.priceHistory || []) {
        if (ph.originalPrice && ph.originalPrice <= 2000 && ph.originalPrice > validMax) {
          validMax = ph.originalPrice;
        }
      }
      p.originalPrice = validMax || p.price;
    }

    // If price was INR (> 2000)
    if (p.price && p.price > 2000) {
      let lastValidPrice = null;
      for (const ph of p.priceHistory || []) {
        if (ph.price && ph.price <= 2000) lastValidPrice = ph.price;
      }
      p.price = lastValidPrice || 50;
    }

    await p.save();
    sanitizedCount++;
  }
  console.log(`   ✅ Sanitized ${sanitizedCount} US products.`);

  // Also expire any contaminated US deals
  const contaminatedUsDeals = await Deal.find({
    country: 'US',
    isExpired: { $ne: true },
    $or: [
      { originalPrice: { $gt: 1000 }, dealPrice: { $lt: 200 } },
      { discountPercentage: { $gte: 95 } }
    ]
  });
  console.log(`   Found ${contaminatedUsDeals.length} contaminated US deals.`);
  for (const d of contaminatedUsDeals) {
    d.isExpired = true;
    d.expiredAt = new Date();
    await d.save();
  }
  console.log(`   ✅ Expired ${contaminatedUsDeals.length} contaminated US deals.`);

  // -------------------------------------------------------------
  // 3. Clean up contaminated IN Products (Telegram glitches < ₹50)
  // -------------------------------------------------------------
  console.log('\n🔧 [3/5] Sanitizing glitched IN products (e.g. SSD for ₹19)...');
  const glitchedInProducts = await Product.find({
    country: 'IN',
    category: { $in: ['electronics', 'appliances'] },
    subCategory: { $nin: ['accessories'] },
    price: { $lt: 50, $gt: 0 }
  });
  console.log(`   Found ${glitchedInProducts.length} glitched IN products.`);
  for (const p of glitchedInProducts) {
    p.isActive = false;
    p.isAvailable = false;
    await p.save();
  }
  const glitchedPids = glitchedInProducts.map(p => p.productId);
  if (glitchedPids.length > 0) {
    await Deal.updateMany(
      { productId: { $in: glitchedPids } },
      { $set: { isExpired: true, expiredAt: new Date() } }
    );
  }
  console.log(`   ✅ Deactivated glitched IN products & expired their deals.`);

  // -------------------------------------------------------------
  // 4. Configure TTL Index on scraping_logs (14 days)
  // -------------------------------------------------------------
  console.log('\n🔧 [4/5] Configuring TTL index on scraping_logs (14 days auto-prune)...');
  try {
    const existingLogIndexes = await db.collection('scraping_logs').indexes();
    const createdAtIdx = existingLogIndexes.find(i => i.name === 'createdAt_1');
    if (createdAtIdx && !createdAtIdx.expireAfterSeconds) {
      console.log('   Dropping non-TTL createdAt_1 index on scraping_logs...');
      await db.collection('scraping_logs').dropIndex('createdAt_1');
    }
    console.log('   Creating TTL index: createdAt_1 with expireAfterSeconds: 14 days (1209600s)...');
    await db.collection('scraping_logs').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 14 * 24 * 3600, background: true, name: 'createdAt_1' }
    );
    console.log('   ✅ TTL index on scraping_logs active.');
  } catch (err) {
    console.warn('   Note on scraping_logs TTL index:', err.message);
  }

  // Also ensure TTL index on deal_channel_events (90 days)
  try {
    const existingEventIndexes = await db.collection('deal_channel_events').indexes();
    const eventCreatedIdx = existingEventIndexes.find(i => i.name === 'createdAt_1');
    if (eventCreatedIdx && !eventCreatedIdx.expireAfterSeconds) {
      console.log('   Dropping non-TTL createdAt_1 index on deal_channel_events...');
      await db.collection('deal_channel_events').dropIndex('createdAt_1');
    }
    console.log('   Creating TTL index: createdAt_1 with expireAfterSeconds: 90 days (7776000s)...');
    await db.collection('deal_channel_events').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 3600, background: true, name: 'createdAt_1' }
    );
    console.log('   ✅ TTL index on deal_channel_events active.');
  } catch (err) {
    console.warn('   Note on deal_channel_events TTL index:', err.message);
  }

  // -------------------------------------------------------------
  // 5. Drop empty legacy collections (scrapinganttokens, scrapinglogs)
  // -------------------------------------------------------------
  console.log('\n🔧 [5/5] Cleaning up legacy empty collections...');
  try {
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    if (names.includes('scrapinganttokens')) {
      const c = await db.collection('scrapinganttokens').countDocuments();
      if (c === 0) {
        await db.collection('scrapinganttokens').drop();
        console.log('   Dropped empty collection: scrapinganttokens');
      }
    }
    if (names.includes('scrapinglogs')) {
      const c = await db.collection('scrapinglogs').countDocuments();
      if (c === 0) {
        await db.collection('scrapinglogs').drop();
        console.log('   Dropped empty collection: scrapinglogs');
      }
    }
  } catch (err) {
    console.warn('   Note on legacy collection cleanup:', err.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('       MULTI-CURRENCY & TTL RESOLUTION COMPLETE');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

fixCurrencyAndTtl().catch(console.error);
