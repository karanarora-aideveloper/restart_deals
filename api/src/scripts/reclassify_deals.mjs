import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import { classifyProduct } from '../utils/categoryClassifier.js';

dotenv.config({ path: './.env' });

async function reclassifyActiveDeals() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB Atlas for Deal & Product Taxonomy Alignment...');

  const activeDeals = await Deal.find({ isExpired: false }).lean();
  console.log(`Inspecting ${activeDeals.length} active deals...`);

  let updatedDealsCount = 0;
  let updatedProductsCount = 0;
  const categoryShiftStats = {};

  for (const deal of activeDeals) {
    const classification = classifyProduct(deal.title, deal.merchant);
    if (!classification) continue;

    const { category, subcategory } = classification;
    const oldCat = deal.category || 'none';
    const oldSub = deal.subcategory || 'none';

    if (category !== oldCat || subcategory !== oldSub) {
      // Record shift stats
      const shiftKey = `${oldCat}:${oldSub} ➔ ${category}:${subcategory}`;
      categoryShiftStats[shiftKey] = (categoryShiftStats[shiftKey] || 0) + 1;

      // Update Deal
      await Deal.updateOne(
        { _id: deal._id },
        { $set: { category, subcategory } }
      );
      updatedDealsCount++;

      // Also align matching Product record if present
      if (deal.productId) {
        const prodRes = await Product.updateOne(
          { $or: [{ productId: deal.productId }, { cleanUrl: deal.dealUrl }] },
          { $set: { category, subcategory } }
        );
        if (prodRes.modifiedCount > 0) {
          updatedProductsCount++;
        }
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`✓ Taxonomy Reclassification Complete:`);
  console.log(`  • Deals Updated:    ${updatedDealsCount} / ${activeDeals.length}`);
  console.log(`  • Products Aligned: ${updatedProductsCount}`);
  console.log(`======================================================\n`);
  console.log(`Top 20 Category Shifts:`);
  const sortedShifts = Object.entries(categoryShiftStats).sort((a, b) => b[1] - a[1]);
  for (const [shift, count] of sortedShifts.slice(0, 20)) {
    console.log(`  ${shift.padEnd(50)} : ${count} deal(s)`);
  }

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

reclassifyActiveDeals().catch(err => {
  console.error('Reclassification failed:', err);
  process.exit(1);
});
