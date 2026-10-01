import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function remediate() {
  console.log('='.repeat(70));
  console.log('       REMEDIATION OF CATALOG & DEALS DATA ANOMALIES');
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  // -------------------------------------------------------------
  // 1. Fix Remaining "General" Products
  // -------------------------------------------------------------
  console.log('🔧 [1/7] Fixing remaining "general" products...');
  const generalProducts = await Product.find({ category: 'general' });
  console.log(`   Found ${generalProducts.length} products in "general".`);
  for (const p of generalProducts) {
    const title = (p.title || '').toLowerCase();
    let cat = 'home';
    let sub = 'decor';
    if (/\b(baby|binder|infant|toddler|diaper)\b/i.test(title)) {
      cat = 'baby-kids';
      sub = 'baby-gear';
    } else if (/\b(trash can|odor filter|filter)\b/i.test(title)) {
      cat = 'home';
      sub = 'cleaning';
    } else if (/\b(savings|voucher|gift card)\b/i.test(title)) {
      cat = 'grocery';
      sub = 'snacks-beverages';
    }
    p.category = cat;
    p.subcategory = sub;
    await p.save();
    console.log(`   -> Fixed PID ${p.productId}: ${cat}:${sub}`);
  }

  // Also sync deals in general
  const generalDeals = await Deal.find({ category: 'general' });
  for (const d of generalDeals) {
    d.category = 'home';
    d.subcategory = 'decor';
    await d.save();
  }

  // -------------------------------------------------------------
  // 2. Reclassify Phone / Tech Accessories in "home"
  // -------------------------------------------------------------
  console.log('\n🔧 [2/7] Reclassifying phone & tech accessories from "home" -> "electronics:accessories"...');
  const phoneAccessoryQuery = {
    category: 'home',
    title: {
      $regex: /\b(iphone|samsung galaxy|pixel|oneplus|airpods|ipad|tablet|apple watch)\b.*\b(case|cover|bumper|protector|strap|band|cable|adapter|charger)\b/i
    }
  };
  const phoneAccessories = await Product.find(phoneAccessoryQuery);
  console.log(`   Found ${phoneAccessories.length} phone accessories misclassified under "home".`);
  
  const accessoryPids = [];
  for (const p of phoneAccessories) {
    p.category = 'electronics';
    p.subcategory = 'accessories';
    await p.save();
    accessoryPids.push(p.productId);
  }
  if (accessoryPids.length > 0) {
    await Deal.updateMany(
      { productId: { $in: accessoryPids } },
      { $set: { category: 'electronics', subcategory: 'accessories' } }
    );
  }
  console.log(`   ✅ Migrated ${phoneAccessories.length} accessories to electronics:accessories.`);

  // -------------------------------------------------------------
  // 3. Reclassify Appliances in "home"
  // -------------------------------------------------------------
  console.log('\n🔧 [3/7] Reclassifying appliances from "home" -> "appliances"...');
  const fridgeQuery = {
    category: 'home',
    title: { $regex: /\b(refrigerator|single door|double door|side by side)\b/i },
    // exclude cleaning accessories / covers
    $nor: [
      { title: { $regex: /\b(cover|mat|stand|tray|cleaner|detergent|basket)\b/i } }
    ]
  };
  const fridges = await Product.find(fridgeQuery);
  console.log(`   Found ${fridges.length} refrigerators under "home".`);
  const fridgePids = [];
  for (const p of fridges) {
    p.category = 'appliances';
    p.subcategory = 'refrigerators';
    await p.save();
    fridgePids.push(p.productId);
  }
  if (fridgePids.length > 0) {
    await Deal.updateMany(
      { productId: { $in: fridgePids } },
      { $set: { category: 'appliances', subcategory: 'refrigerators' } }
    );
  }

  const washerQuery = {
    category: 'home',
    title: { $regex: /\b(washing machine|front load|top load|semi automatic)\b/i },
    $nor: [
      { title: { $regex: /\b(cover|liquid|detergent|cleaner|stand|powder|descaler)\b/i } }
    ]
  };
  const washers = await Product.find(washerQuery);
  console.log(`   Found ${washers.length} washing machines under "home".`);
  const washerPids = [];
  for (const p of washers) {
    p.category = 'appliances';
    p.subcategory = 'washing-machines';
    await p.save();
    washerPids.push(p.productId);
  }
  if (washerPids.length > 0) {
    await Deal.updateMany(
      { productId: { $in: washerPids } },
      { $set: { category: 'appliances', subcategory: 'washing-machines' } }
    );
  }

  // -------------------------------------------------------------
  // 4. Expire Zero & Negative Discount Active Deals
  // -------------------------------------------------------------
  console.log('\n🔧 [4/7] Expiring active deals with 0% or negative discount...');
  const zeroDiscountDeals = await Deal.find({
    isExpired: { $ne: true },
    $or: [
      { discountPercentage: { $lte: 0 } },
      { discountPercentage: null },
      { $expr: { $gte: ['$dealPrice', '$originalPrice'] } }
    ]
  });
  console.log(`   Found ${zeroDiscountDeals.length} active deals with <= 0% discount.`);
  const zeroIds = zeroDiscountDeals.map(d => d._id);
  if (zeroIds.length > 0) {
    await Deal.updateMany(
      { _id: { $in: zeroIds } },
      { $set: { isExpired: true, expiredAt: new Date() } }
    );
    console.log(`   ✅ Expired ${zeroIds.length} zero-discount deals.`);
  }

  // -------------------------------------------------------------
  // 5. Expire Currency-Bleed US Deals & Telegram Text Glitches (>95% discount)
  // -------------------------------------------------------------
  console.log('\n🔧 [5/7] Expiring currency-mismatch and Telegram text parsing glitches...');
  const extremeDeals = await Deal.find({
    isExpired: { $ne: true },
    discountPercentage: { $gte: 95 }
  });
  console.log(`   Found ${extremeDeals.length} active deals with >= 95% discount.`);

  let expiredExtreme = 0;
  for (const d of extremeDeals) {
    // US deals with INR MRP
    const isUsCurrencyMismatch = d.country === 'US' && d.originalPrice > 1000 && d.dealPrice < 200;
    // Telegram text parse glitch (e.g. 19k parsed as 19)
    const isTextGlitch = (d.priceSource === 'price_history' || d.priceSource === 'ai_text') && d.dealPrice < 50;
    // Identical price vs MRP or 100% discount
    const isSuspicious100 = d.discountPercentage >= 99 && (d.dealPrice === d.originalPrice || d.dealPrice < 50);

    if (isUsCurrencyMismatch || isTextGlitch || isSuspicious100) {
      d.isExpired = true;
      d.expiredAt = new Date();
      await d.save();
      expiredExtreme++;
    }
  }
  console.log(`   ✅ Expired ${expiredExtreme} glitched/currency-mismatched deals.`);

  // -------------------------------------------------------------
  // 6. Deduplicate Active Deals for Same Product
  // -------------------------------------------------------------
  console.log('\n🔧 [6/7] Deduplicating active deals for the same product...');
  const dupActiveDeals = await Deal.aggregate([
    { $match: { isExpired: { $ne: true }, productId: { $exists: true, $ne: null } } },
    { $group: { _id: '$productId', count: { $sum: 1 }, deals: { $push: { id: '$_id', updatedAt: '$updatedAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log(`   Found ${dupActiveDeals.length} product IDs with multiple active deals.`);

  let dupExpired = 0;
  for (const group of dupActiveDeals) {
    // Sort descending by updatedAt - keep the newest one
    group.deals.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    // Keep first, expire rest
    const toExpire = group.deals.slice(1).map(d => d.id);
    await Deal.updateMany(
      { _id: { $in: toExpire } },
      { $set: { isExpired: true, expiredAt: new Date() } }
    );
    dupExpired += toExpire.length;
  }
  console.log(`   ✅ Expired ${dupExpired} duplicate older deal records.`);

  // -------------------------------------------------------------
  // 7. Deactivate Unpriced Products (Price <= 0 or null)
  // -------------------------------------------------------------
  console.log('\n🔧 [7/7] Deactivating products with zero or null price...');
  const unpricedResult = await Product.updateMany(
    {
      $and: [
        { $or: [{ price: { $lte: 0 } }, { price: null }, { price: { $exists: false } }] },
        { $or: [{ isActive: true }, { isAvailable: true }] }
      ]
    },
    { $set: { isActive: false, isAvailable: false } }
  );
  console.log(`   ✅ Deactivated ${unpricedResult.modifiedCount} unpriced products.`);

  console.log('\n' + '='.repeat(70));
  console.log('       REMEDIATION COMPLETED SUCCESSFULLY');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

remediate().catch(console.error);
