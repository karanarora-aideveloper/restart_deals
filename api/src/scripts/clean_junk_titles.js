import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const JUNK_REGEXES = [
  /^(possible\s+)?price\s+error/i,
  /^recurring\s+savings/i,
  /^below\s+avg/i,
  /^price\s+drop/i,
  /^loot\s+/i,
  /^grab\s+fast/i,
  /^don'?t\s+miss/i,
  /^limited\s+time/i,
  /^flash\s+sale/i,
  /^hurry\s+up/i,
  /^product\s+item/i,
  /^queued\s+for/i,
  /^tracked\s+product/i,
  /^deal\s+item/i,
  /^boldfit$/i,
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas.');

  const filter = {
    $or: JUNK_REGEXES.map((r) => ({ title: { $regex: r } })),
  };

  // 1. Clean Products
  const junkProducts = await Product.find(filter).select('_id productId merchant title cleanUrl').lean();
  console.log(`Found ${junkProducts.length} products with junk titles.`);

  if (junkProducts.length > 0) {
    const productPids = junkProducts.map(p => p.productId).filter(Boolean);
    const matchingDeals = await Deal.find({
      productId: { $in: productPids },
      $nor: JUNK_REGEXES.map((r) => ({ title: { $regex: r } })),
    }).select('productId title').lean();

    const dealTitleMap = new Map(matchingDeals.map(d => [d.productId, d.title]));

    const bulkOps = junkProducts.map((p) => {
      const betterTitle = dealTitleMap.get(p.productId)
        || `${p.merchant ? p.merchant.charAt(0).toUpperCase() + p.merchant.slice(1) : 'Store'} Item (${p.productId})`;
      return {
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { title: betterTitle } },
        },
      };
    });

    await Product.bulkWrite(bulkOps);
    console.log(`✓ Cleaned ${bulkOps.length} products.`);
  }

  // 2. Clean Deals
  const junkDeals = await Deal.find(filter).select('_id productId merchant title dealUrl').lean();
  console.log(`Found ${junkDeals.length} deals with junk titles.`);

  if (junkDeals.length > 0) {
    const dealPids = junkDeals.map(d => d.productId).filter(Boolean);
    const matchingProducts = await Product.find({
      productId: { $in: dealPids },
      $nor: JUNK_REGEXES.map((r) => ({ title: { $regex: r } })),
    }).select('productId title').lean();

    const prodTitleMap = new Map(matchingProducts.map(p => [p.productId, p.title]));

    const dealBulkOps = junkDeals.map((d) => {
      const betterTitle = prodTitleMap.get(d.productId)
        || `${d.merchant ? d.merchant.charAt(0).toUpperCase() + d.merchant.slice(1) : 'Store'} Deal (${d.productId})`;
      return {
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { title: betterTitle } },
        },
      };
    });

    await Deal.bulkWrite(dealBulkOps);
    console.log(`✓ Cleaned ${dealBulkOps.length} deals.`);
  }

  await mongoose.disconnect();
  console.log('✓ All junk titles sanitized successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error running cleanup:', err);
  process.exit(1);
});
