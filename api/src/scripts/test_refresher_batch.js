import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { refreshStaleProductBatch, getRefresherStatus } from '../jobs/dailyProductRefresher.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testRefresher() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected.');

  console.log('\n--- Checking Initial Refresher Status ---');
  const initialStatus = await getRefresherStatus();
  console.log('Status:', {
    totalProducts: initialStatus.totalProducts,
    refreshedLast24h: initialStatus.refreshedLast24h,
    pendingRefresh: initialStatus.pendingRefresh,
    freshnessPercentage: `${initialStatus.freshnessPercentage}%`,
    activeDeals: initialStatus.deals.active,
    expiredDeals: initialStatus.deals.expired
  });

  console.log('\n--- Running 3-Product Refresh Batch Test ---');
  const result = await refreshStaleProductBatch(3);
  console.log('Batch Result:', result);

  await mongoose.disconnect();
  process.exit(0);
}

testRefresher().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
