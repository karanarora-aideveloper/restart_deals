import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function inspectAnomalies() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.\n');

  // 1. Inspect the 2 products still in "general"
  const generalProducts = await Product.find({ category: 'general' }).lean();
  console.log('--- 1. Products in "general":', generalProducts.length);
  for (const p of generalProducts) {
    console.log(`ID: ${p._id}, PID: ${p.productId}, Title: ${p.title?.slice(0, 70)}, created: ${p.createdAt}`);
  }

  // 2. Check field name: subcategory vs subCategory
  const countLower = await Product.countDocuments({ subcategory: { $exists: true, $ne: '', $ne: null } });
  const countCamel = await Product.countDocuments({ subCategory: { $exists: true, $ne: '', $ne: null } });
  console.log(`\n--- 2. Subcategory field counts:`);
  console.log(`   products with "subcategory" (lowercase): ${countLower}`);
  console.log(`   products with "subCategory" (camelCase): ${countCamel}`);

  // 3. Inspect extreme discount deals (>95%)
  const extremeDeals = await Deal.find({
    isExpired: { $ne: true },
    discountPercentage: { $gt: 95 }
  }).limit(10).lean();

  console.log(`\n--- 3. Sample of Extreme Discount Deals (>95%):`);
  for (const d of extremeDeals) {
    console.log(`Deal [${d._id}]: PID: ${d.productId}, Title: ${d.title?.slice(0, 50)}, DealPrice: ${d.dealPrice}, MRP: ${d.originalPrice}, Discount: ${d.discountPercentage}%, Country: ${d.country}, Merchant: ${d.merchant}, CleanUrl: ${d.dealUrl?.slice(0, 60)}`);
  }

  // 4. Inspect zero-discount active deals
  const zeroDeals = await Deal.find({
    isExpired: { $ne: true },
    $or: [{ discountPercentage: { $lte: 0 } }, { discountPercentage: null }]
  }).limit(10).lean();

  console.log(`\n--- 4. Sample of Zero Discount Active Deals:`);
  for (const d of zeroDeals) {
    console.log(`Deal [${d._id}]: PID: ${d.productId}, Title: ${d.title?.slice(0, 50)}, DealPrice: ${d.dealPrice}, MRP: ${d.originalPrice}, Discount: ${d.discountPercentage}%, Verified: ${d.isVerified}`);
  }

  // 5. Inspect duplicate active deals
  const dupActiveDeals = await Deal.aggregate([
    { $match: { isExpired: { $ne: true }, productId: { $exists: true, $ne: null } } },
    { $group: { _id: '$productId', count: { $sum: 1 }, deals: { $push: { id: '$_id', price: '$dealPrice', created: '$createdAt' } } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 }
  ]);
  console.log(`\n--- 5. Sample of Duplicate Active Deals:`);
  for (const d of dupActiveDeals) {
    console.log(`PID: ${d._id} (${d.count}x):`, JSON.stringify(d.deals));
  }

  // 6. Inspect products with price <= 0
  const zeroPriceProducts = await Product.find({
    $or: [{ price: { $lte: 0 } }, { price: null }]
  }).limit(5).lean();
  console.log(`\n--- 6. Sample of Zero/Null Price Products:`);
  for (const p of zeroPriceProducts) {
    console.log(`PID: ${p.productId}, Title: ${p.title?.slice(0, 50)}, Price: ${p.price}, MRP: ${p.originalPrice}, Merchant: ${p.merchant}`);
  }

  // 7. Check Refrigerator in 'home'
  const fridgesInHome = await Product.find({
    category: 'home',
    title: { $regex: /\brefrigerator\b/i }
  }).limit(5).lean();
  console.log(`\n--- 7. Sample of Refrigerators in 'home':`);
  for (const p of fridgesInHome) {
    console.log(`PID: ${p.productId}, Title: ${p.title?.slice(0, 60)}, Cat: ${p.category}, SubCat: ${p.subcategory}`);
  }

  // 8. Check phone cases in 'home'
  const casesInHome = await Product.find({
    category: 'home',
    title: { $regex: /\b(iphone|samsung galaxy).*case\b/i }
  }).limit(5).lean();
  console.log(`\n--- 8. Sample of Phone Cases in 'home':`);
  for (const p of casesInHome) {
    console.log(`PID: ${p.productId}, Title: ${p.title?.slice(0, 60)}, Cat: ${p.category}, SubCat: ${p.subcategory}`);
  }

  await mongoose.disconnect();
}

inspectAnomalies().catch(console.error);
