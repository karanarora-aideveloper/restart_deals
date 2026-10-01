import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const CANONICAL_DEPARTMENTS = new Set([
  'electronics',
  'appliances',
  'men-fashion',
  'women-fashion',
  'beauty',
  'home',
  'grocery',
  'fitness',
  'baby-kids',
  'books-stationery',
  'auto',
]);

async function runAudit() {
  console.log('='.repeat(70));
  console.log('       COMPREHENSIVE DATA & CATALOG QUALITY AUDIT');
  console.log('='.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI not found.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  const totalProducts = await Product.countDocuments();
  const totalDeals = await Deal.countDocuments();
  const activeDeals = await Deal.countDocuments({ isExpired: { $ne: true } });
  const expiredDeals = await Deal.countDocuments({ isExpired: true });

  console.log(`📊 Catalog Overview:`);
  console.log(`   - Total Products:     ${totalProducts.toLocaleString()}`);
  console.log(`   - Total Deals:        ${totalDeals.toLocaleString()}`);
  console.log(`   - Active Deals:       ${activeDeals.toLocaleString()}`);
  console.log(`   - Expired Deals:      ${expiredDeals.toLocaleString()}\n`);

  const anomalies = {
    critical: [],
    warning: [],
    info: [],
  };

  // ==========================================
  // 1. CATEGORY & TAXONOMY AUDIT
  // ==========================================
  console.log('🔍 [1/6] Auditing Taxonomy & Categories...');

  const missingCategory = await Product.countDocuments({
    $or: [{ category: null }, { category: '' }, { category: { $exists: false } }],
  });
  if (missingCategory > 0) {
    anomalies.critical.push({
      issue: 'Products missing top-level category',
      count: missingCategory,
      detail: `${missingCategory} products have null/empty category`,
    });
  }

  const missingSubcategory = await Product.countDocuments({
    $or: [{ subcategory: null }, { subcategory: '' }, { subcategory: { $exists: false } }],
  });
  if (missingSubcategory > 0) {
    anomalies.warning.push({
      issue: 'Products missing subcategory',
      count: missingSubcategory,
      detail: `${missingSubcategory} products have null/empty subcategory`,
    });
  }

  const generalProducts = await Product.countDocuments({ category: 'general' });
  if (generalProducts > 0) {
    anomalies.critical.push({
      issue: 'Products tagged as "general"',
      count: generalProducts,
      detail: `${generalProducts} products still have category: "general"`,
    });
  }

  // Check for non-canonical categories
  const categoryAgg = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const nonCanonicalCats = [];
  for (const cat of categoryAgg) {
    if (!CANONICAL_DEPARTMENTS.has(cat._id)) {
      nonCanonicalCats.push(cat);
    }
  }
  if (nonCanonicalCats.length > 0) {
    anomalies.critical.push({
      issue: 'Non-canonical top-level categories in products',
      count: nonCanonicalCats.reduce((acc, c) => acc + c.count, 0),
      detail: nonCanonicalCats.map((c) => `"${c._id}" (${c.count})`).join(', '),
    });
  }

  // Check misclassified keywords in products (e.g. mobile phone tagged in home)
  console.log('   Checking for prominent title-category contradictions...');
  const suspiciousMobileInHome = await Product.find(
    {
      category: 'home',
      title: { $regex: /\b(smartphone|iphone|oneplus|realme 5g|redmi note|samsung galaxy)\b/i },
    },
    { title: 1, category: 1, subCategory: 1 }
  ).limit(10).lean();

  if (suspiciousMobileInHome.length > 0) {
    anomalies.warning.push({
      issue: 'Smartphones classified under "home"',
      count: suspiciousMobileInHome.length,
      sample: suspiciousMobileInHome.map((p) => p.title.slice(0, 60)),
    });
  }

  const suspiciousAppliancesInHome = await Product.find(
    {
      category: 'home',
      title: { $regex: /\b(refrigerator|washing machine|inverter split ac|air conditioner|water purifier|geyser)\b/i },
      subCategory: { $nin: ['cleaning', 'tools', 'kitchen-dining'] },
    },
    { title: 1, category: 1, subCategory: 1 }
  ).limit(10).lean();

  if (suspiciousAppliancesInHome.length > 0) {
    anomalies.warning.push({
      issue: 'Major appliances classified under "home" instead of "appliances"',
      count: suspiciousAppliancesInHome.length,
      sample: suspiciousAppliancesInHome.map((p) => p.title.slice(0, 60)),
    });
  }

  // ==========================================
  // 2. PRICING & DISCOUNT AUDIT
  // ==========================================
  console.log('🔍 [2/6] Auditing Prices & Discounts...');

  const zeroOrNegativePrice = await Product.countDocuments({
    $or: [{ price: { $lte: 0 } }, { price: null }, { price: { $exists: false } }],
  });
  if (zeroOrNegativePrice > 0) {
    anomalies.critical.push({
      issue: 'Products with zero, negative or missing price',
      count: zeroOrNegativePrice,
    });
  }

  // Price > MRP (negative discount / markup)
  const priceGreaterThanMrp = await Product.countDocuments({
    price: { $gt: 0 },
    originalPrice: { $gt: 0 },
    $expr: { $gt: ['$price', '$originalPrice'] },
  });
  if (priceGreaterThanMrp > 0) {
    anomalies.warning.push({
      issue: 'Products where selling price > originalPrice (MRP markup)',
      count: priceGreaterThanMrp,
      detail: `${priceGreaterThanMrp} products have price > originalPrice`,
    });
  }

  // Active Deals with 0% discount
  const zeroDiscountActiveDeals = await Deal.countDocuments({
    isExpired: { $ne: true },
    $or: [
      { discountPercentage: { $lte: 0 } },
      { discountPercentage: null },
      { $expr: { $gte: ['$dealPrice', '$originalPrice'] } },
    ],
  });
  if (zeroDiscountActiveDeals > 0) {
    anomalies.critical.push({
      issue: 'Active deals with 0% or negative discount',
      count: zeroDiscountActiveDeals,
      detail: `${zeroDiscountActiveDeals} active deals have discount <= 0%`,
    });
  }

  // Unrealistic discounts (> 95% discount)
  const excessiveDiscount = await Deal.find(
    {
      isExpired: { $ne: true },
      discountPercentage: { $gt: 95 },
    },
    { title: 1, dealPrice: 1, originalPrice: 1, discountPercentage: 1 }
  ).limit(10).lean();

  if (excessiveDiscount.length > 0) {
    const countExcessive = await Deal.countDocuments({
      isExpired: { $ne: true },
      discountPercentage: { $gt: 95 },
    });
    anomalies.warning.push({
      issue: 'Active deals with extreme discount (>95%)',
      count: countExcessive,
      sample: excessiveDiscount.map(
        (d) => `${d.title.slice(0, 45)}: ₹${d.dealPrice} vs MRP ₹${d.originalPrice} (${d.discountPercentage}%)`
      ),
    });
  }

  // Extreme prices (> ₹10,00,000 or < ₹20 for electronics)
  const ultraCheapElectronics = await Product.countDocuments({
    category: 'electronics',
    subCategory: { $in: ['mobiles', 'laptops', 'tv'] },
    price: { $lt: 500, $gt: 0 },
  });
  if (ultraCheapElectronics > 0) {
    anomalies.warning.push({
      issue: 'Suspiciously cheap high-tier electronics (< ₹500 for mobile/laptop/tv)',
      count: ultraCheapElectronics,
    });
  }

  // Country vs Currency consistency
  const countryCurrencyMismatch = await Product.countDocuments({
    country: 'IN',
    currency: { $exists: true, $nin: ['INR', null, ''] },
  });
  if (countryCurrencyMismatch > 0) {
    anomalies.warning.push({
      issue: 'Country IN products with non-INR currency',
      count: countryCurrencyMismatch,
    });
  }

  // ==========================================
  // 3. PRODUCT URLS & DUPLICATION AUDIT
  // ==========================================
  console.log('🔍 [3/6] Auditing Identifiers & Duplications...');

  // Duplicate productId
  const dupProductIds = await Product.aggregate([
    { $match: { productId: { $exists: true, $ne: null } } },
    { $group: { _id: '$productId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (dupProductIds.length > 0) {
    anomalies.critical.push({
      issue: 'Duplicate productId in products collection',
      count: dupProductIds.length,
      totalDuplicates: dupProductIds.reduce((acc, d) => acc + d.count, 0),
      sample: dupProductIds.slice(0, 5).map((d) => `${d._id} (${d.count}x)`),
    });
  }

  // Duplicate cleanUrl
  const dupCleanUrls = await Product.aggregate([
    { $match: { cleanUrl: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$cleanUrl', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (dupCleanUrls.length > 0) {
    anomalies.warning.push({
      issue: 'Duplicate cleanUrl in products collection',
      count: dupCleanUrls.length,
      totalDuplicates: dupCleanUrls.reduce((acc, d) => acc + d.count, 0),
      sample: dupCleanUrls.slice(0, 5).map((d) => `${d._id.slice(0, 60)} (${d.count}x)`),
    });
  }

  // Missing title or image
  const missingTitle = await Product.countDocuments({
    $or: [{ title: null }, { title: '' }, { title: 'Untitled' }, { title: { $exists: false } }],
  });
  if (missingTitle > 0) {
    anomalies.critical.push({
      issue: 'Products with missing or untitled title',
      count: missingTitle,
    });
  }

  const missingImage = await Product.countDocuments({
    $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }],
  });
  if (missingImage > 0) {
    anomalies.warning.push({
      issue: 'Products with missing imageUrl',
      count: missingImage,
    });
  }

  // CleanUrl with affiliate tags still embedded
  const dirtyUrls = await Product.countDocuments({
    cleanUrl: { $regex: /(tag=|linkCode=|ascsubtag=|ref_=as_)/i },
  });
  if (dirtyUrls > 0) {
    anomalies.warning.push({
      issue: 'Products where cleanUrl contains residual affiliate tags',
      count: dirtyUrls,
    });
  }

  // ==========================================
  // 4. DEALS INTEGRITY & ORPHAN DEALS AUDIT
  // ==========================================
  console.log('🔍 [4/6] Auditing Deals Integrity & Orphanage...');

  // Check deals whose productId does not exist in products
  const sampleDeals = await Deal.find({}, { productId: 1, cleanUrl: 1, isExpired: 1, dealPrice: 1 }).lean();
  const productIdsSet = new Set(
    (await Product.find({}, { productId: 1 }).lean()).map((p) => p.productId).filter(Boolean)
  );

  let orphanDealsCount = 0;
  for (const d of sampleDeals) {
    if (d.productId && !productIdsSet.has(d.productId)) {
      orphanDealsCount++;
    }
  }

  if (orphanDealsCount > 0) {
    anomalies.warning.push({
      issue: 'Orphan deals (productId not found in products collection)',
      count: orphanDealsCount,
      detail: `${orphanDealsCount} deals point to productIds not in products`,
    });
  }

  // Duplicate active deals for the same productId
  const dupActiveDeals = await Deal.aggregate([
    { $match: { isExpired: { $ne: true }, productId: { $exists: true, $ne: null } } },
    { $group: { _id: '$productId', count: { $sum: 1 }, dealIds: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (dupActiveDeals.length > 0) {
    anomalies.warning.push({
      issue: 'Duplicate active deals for the same productId',
      count: dupActiveDeals.length,
      sample: dupActiveDeals.slice(0, 5).map((d) => `${d._id} (${d.count}x)`),
    });
  }

  // Past lightning deals that are not marked expired
  const now = new Date();
  const expiredTimersNotMarked = await Deal.countDocuments({
    isExpired: { $ne: true },
    lightningDealEndsAt: { $lt: now },
  });
  if (expiredTimersNotMarked > 0) {
    anomalies.warning.push({
      issue: 'Lightning deals past end time but still marked active',
      count: expiredTimersNotMarked,
    });
  }

  // Deals marked isVerified: true with 0% discount
  const verifiedZeroDiscount = await Deal.countDocuments({
    isVerified: true,
    isExpired: { $ne: true },
    $or: [{ discountPercentage: { $lte: 0 } }, { discountPercentage: null }],
  });
  if (verifiedZeroDiscount > 0) {
    anomalies.critical.push({
      issue: 'Verified active deals with 0% or null discount',
      count: verifiedZeroDiscount,
    });
  }

  // ==========================================
  // 5. PRICE HISTORY INTEGRITY AUDIT
  // ==========================================
  console.log('🔍 [5/6] Auditing Price History...');

  const missingPriceHistory = await Product.countDocuments({
    $or: [{ 'priceHistory.0': { $exists: false } }, { priceHistory: null }, { priceHistory: { $exists: false } }],
  });
  if (missingPriceHistory > 0) {
    anomalies.info.push({
      issue: 'Products with no price history entries',
      count: missingPriceHistory,
      detail: `${missingPriceHistory} products have empty priceHistory array`,
    });
  }

  // Check duplicate daily checkpoints in sample products
  const productsWithHistory = await Product.find(
    { 'priceHistory.1': { $exists: true } },
    { priceHistory: 1 }
  ).limit(500).lean();

  let dupDatesInHistoryCount = 0;
  for (const p of productsWithHistory) {
    const dates = new Set();
    let hasDup = false;
    for (const ph of p.priceHistory || []) {
      const d = ph.date || ph.timestamp?.toISOString()?.slice(0, 10);
      if (d) {
        if (dates.has(d)) {
          hasDup = true;
          break;
        }
        dates.add(d);
      }
    }
    if (hasDup) dupDatesInHistoryCount++;
  }

  if (dupDatesInHistoryCount > 0) {
    anomalies.warning.push({
      issue: 'Price history contains duplicate checkpoints for the same calendar date',
      count: dupDatesInHistoryCount,
      detail: `${dupDatesInHistoryCount} out of 500 sampled products have same-day duplicate entries`,
    });
  }

  // ==========================================
  // 6. STORE SYNC TIMESTAMPS & AVAILABILITY
  // ==========================================
  console.log('🔍 [6/6] Auditing Sync Freshness & Stock...');

  const neverSynced = await Product.countDocuments({
    $or: [{ lastStoreSyncAt: null }, { lastStoreSyncAt: { $exists: false } }],
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const syncedLast24h = await Product.countDocuments({ lastStoreSyncAt: { $gte: twentyFourHoursAgo } });
  const syncedLast7d = await Product.countDocuments({
    lastStoreSyncAt: { $gte: sevenDaysAgo, $lt: twentyFourHoursAgo },
  });
  const syncedLast30d = await Product.countDocuments({
    lastStoreSyncAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo },
  });
  const syncedOlderThan30d = await Product.countDocuments({
    lastStoreSyncAt: { $lt: thirtyDaysAgo },
  });

  const oosActiveDeals = await Deal.countDocuments({
    isExpired: { $ne: true },
    isAvailable: false,
  });
  if (oosActiveDeals > 0) {
    anomalies.warning.push({
      issue: 'Active deals marked as out of stock (isAvailable: false)',
      count: oosActiveDeals,
    });
  }

  // ==========================================
  // SUMMARY REPORT GENERATION
  // ==========================================
  console.log('\n' + '='.repeat(70));
  console.log('                      AUDIT SUMMARY RESULTS');
  console.log('='.repeat(70));

  console.log(`\n🚨 CRITICAL ANOMALIES (${anomalies.critical.length}):`);
  if (anomalies.critical.length === 0) {
    console.log('   ✅ None found!');
  } else {
    for (const [idx, item] of anomalies.critical.entries()) {
      console.log(`   ${idx + 1}. [${item.issue}] Count: ${item.count}`);
      if (item.detail) console.log(`      Detail: ${item.detail}`);
      if (item.sample) console.log(`      Sample: ${JSON.stringify(item.sample)}`);
    }
  }

  console.log(`\n⚠️  WARNING ANOMALIES (${anomalies.warning.length}):`);
  if (anomalies.warning.length === 0) {
    console.log('   ✅ None found!');
  } else {
    for (const [idx, item] of anomalies.warning.entries()) {
      console.log(`   ${idx + 1}. [${item.issue}] Count: ${item.count}`);
      if (item.detail) console.log(`      Detail: ${item.detail}`);
      if (item.sample) console.log(`      Sample: ${JSON.stringify(item.sample)}`);
    }
  }

  console.log(`\nℹ️  INFORMATIONAL ITEMS (${anomalies.info.length}):`);
  for (const [idx, item] of anomalies.info.entries()) {
    console.log(`   ${idx + 1}. [${item.issue}] Count: ${item.count}`);
    if (item.detail) console.log(`      Detail: ${item.detail}`);
  }

  console.log(`\n⏱️ Sync Cadence Freshness:`);
  console.log(`   - Synced in last 24h:   ${syncedLast24h.toLocaleString()} (${((syncedLast24h / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`   - Synced 1 to 7 days:   ${syncedLast7d.toLocaleString()} (${((syncedLast7d / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`   - Synced 7 to 30 days:  ${syncedLast30d.toLocaleString()} (${((syncedLast30d / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`   - Synced > 30 days ago: ${syncedOlderThan30d.toLocaleString()} (${((syncedOlderThan30d / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`   - Never Synced:         ${neverSynced.toLocaleString()} (${((neverSynced / totalProducts) * 100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(70));
  await mongoose.disconnect();
  console.log('[DB] Disconnected.');
}

runAudit().catch((err) => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
