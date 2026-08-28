import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function ensureIndexes() {
  console.log('==================================================');
  console.log('      BUILDING HIGH-PERFORMANCE DB INDEXES        ');
  console.log('==================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  console.log('\n[Index Migration] Creating Deal indexes...');
  const dealIndexes = await Deal.createIndexes();
  console.log('[Index Migration] ✓ Deal indexes built:', dealIndexes);

  console.log('\n[Index Migration] Creating Product indexes...');
  const productIndexes = await Product.createIndexes();
  console.log('[Index Migration] ✓ Product indexes built:', productIndexes);

  const existingDealIndexes = await Deal.collection.indexes();
  console.log('\n--- Active Deal Indexes ---');
  for (const idx of existingDealIndexes) {
    console.log(` • ${idx.name}:`, JSON.stringify(idx.key));
  }

  const existingProductIndexes = await Product.collection.indexes();
  console.log('\n--- Active Product Indexes ---');
  for (const idx of existingProductIndexes) {
    console.log(` • ${idx.name}:`, JSON.stringify(idx.key));
  }

  await mongoose.disconnect();
  console.log('\n[DB] Disconnected.');
  process.exit(0);
}

ensureIndexes().catch(e => {
  console.error('[Error]:', e);
  process.exit(1);
});
