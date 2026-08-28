import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testDealsFilter() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.');

  const totalDeals = await Deal.countDocuments();
  const activeDeals = await Deal.countDocuments({ isExpired: { $ne: true } });
  const expiredDeals = await Deal.countDocuments({ isExpired: true });

  console.log('--- Public Deal Feed Health ---');
  console.log(`Total Deals in DB: ${totalDeals}`);
  console.log(`Active (Fresh/Verified) Deals: ${activeDeals}`);
  console.log(`Expired Deals (Filtered out of public view): ${expiredDeals}`);

  await mongoose.disconnect();
  process.exit(0);
}

testDealsFilter().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
