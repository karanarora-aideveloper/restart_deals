import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import { rankCrossStoreMatches } from '../utils/vectorMatcher.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testMatchesInDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.\n');

  // Let's test a sample of products across our database
  const sampleProducts = await Product.find({ title: { $regex: /boat|noise|iphone|samsung|shoes|sneaker|protein/i } })
    .limit(5)
    .lean();

  for (const prod of sampleProducts) {
    console.log(`\n=======================================================`);
    console.log(`Target: [${prod.merchant?.toUpperCase()}] "${prod.title}" (₹${prod.price})`);

    const candidates = await Product.find({ merchant: { $ne: prod.merchant } })
      .select('_id productId merchant title cleanUrl price category')
      .limit(100)
      .lean();

    const { exactMatches, similarMatches } = rankCrossStoreMatches(prod, candidates);

    console.log(`  🟢 Exact Matches (${exactMatches.length}):`);
    for (const em of exactMatches.slice(0, 2)) {
      console.log(`     • [${em.product.merchant}] "${em.product.title}" - ₹${em.product.price} (Score: ${em.matchScore})`);
    }

    console.log(`  🟡 Similar Matches (${similarMatches.length}):`);
    for (const sm of similarMatches.slice(0, 3)) {
      console.log(`     • [${sm.product.merchant}] "${sm.product.title}" - ₹${sm.product.price} (Score: ${sm.matchScore})`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

testMatchesInDb().catch(e => {
  console.error(e);
  process.exit(1);
});
