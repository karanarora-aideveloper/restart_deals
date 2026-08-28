import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function auditDealsAndProducts() {
  console.log('==================================================');
  console.log('       AUDIT: DEALS vs PRODUCTS SUBSET CHECK      ');
  console.log('==================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  const totalDeals = await Deal.countDocuments();
  const totalProducts = await Product.countDocuments();
  const activeDeals = await Deal.countDocuments({ isExpired: { $ne: true } });

  console.log(`📊 Total Deals in DB:     ${totalDeals} (Active: ${activeDeals})`);
  console.log(`📦 Total Products in DB:  ${totalProducts}\n`);

  // Load all productIds and cleanUrls from Products collection into fast Sets
  console.log('[Audit] Indexing all Products in memory...');
  const allProducts = await Product.find({}, { productId: 1, cleanUrl: 1, _id: 1 }).lean();
  
  const productPidSet = new Set(allProducts.map(p => p.productId).filter(Boolean));
  const productCleanUrlSet = new Set(allProducts.map(p => p.cleanUrl?.toLowerCase().trim()).filter(Boolean));

  console.log(`[Audit] Indexed ${productPidSet.size} unique productIds and ${productCleanUrlSet.size} cleanUrls.\n`);

  // Stream all deals and check membership
  const allDeals = await Deal.find({}, { _id: 1, title: 1, dealUrl: 1, productId: 1, merchant: 1, dealPrice: 1, originalPrice: 1, isExpired: 1, createdAt: 1 }).lean();

  let matchedByPid = 0;
  let matchedByUrl = 0;
  const orphanDeals = [];

  for (const deal of allDeals) {
    let matched = false;

    if (deal.productId && productPidSet.has(deal.productId)) {
      matchedByPid++;
      matched = true;
    } else if (deal.dealUrl) {
      const clean = deal.dealUrl.split('?')[0].toLowerCase().trim();
      if (productCleanUrlSet.has(clean)) {
        matchedByUrl++;
        matched = true;
      }
    }

    if (!matched) {
      orphanDeals.push({
        dealId: deal._id,
        productId: deal.productId,
        title: deal.title || 'Untitled Deal',
        dealUrl: deal.dealUrl,
        merchant: deal.merchant || 'unknown',
        price: deal.dealPrice,
        originalPrice: deal.originalPrice,
        isExpired: deal.isExpired,
        createdAt: deal.createdAt,
      });
    }
  }

  const matchedTotal = matchedByPid + matchedByUrl;
  const matchPercentage = totalDeals > 0 ? ((matchedTotal / totalDeals) * 100).toFixed(2) : 100;

  console.log('--------------------------------------------------');
  console.log('                 AUDIT RESULTS                    ');
  console.log('--------------------------------------------------');
  console.log(`✅ Deals matched by productId: ${matchedByPid}`);
  console.log(`✅ Deals matched by cleanUrl:  ${matchedByUrl}`);
  console.log(`🎯 Total Matched Deals:        ${matchedTotal} / ${totalDeals} (${matchPercentage}%)`);
  console.log(`❌ Orphan Deals (No Product):  ${orphanDeals.length} / ${totalDeals}\n`);

  if (orphanDeals.length > 0) {
    console.log('Sample Orphan Deals:');
    orphanDeals.slice(0, 5).forEach((d, i) => {
      console.log(`  ${i + 1}. [${d.merchant.toUpperCase()}] "${d.title.slice(0, 50)}..."`);
      console.log(`     Deal ID: ${d.dealId} | Product ID: ${d.productId || 'NONE'}`);
      console.log(`     URL: ${d.dealUrl}\n`);
    });
  }

  await mongoose.disconnect();
}

auditDealsAndProducts().catch(err => {
  console.error('Audit Fatal Error:', err);
  process.exit(1);
});
