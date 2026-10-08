import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

async function runCleanup() {
  console.log('Connecting to MongoDB Atlas...');
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;

  const statsBefore = await db.stats();
  console.log(`\n======================================================================`);
  console.log(`🧹 MONGODB ATLAS STORAGE COMPACTOR & CLEANUP`);
  console.log(`======================================================================`);
  console.log(`Initial Data Size:    ${(statsBefore.dataSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Initial Storage Size: ${(statsBefore.storageSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Initial Index Size:   ${(statsBefore.indexSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Initial Total Size:   ${((statsBefore.storageSize + statsBefore.indexSize) / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`======================================================================\n`);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Purge ephemeral scraping logs older than 2 days
  console.log('1. Cleaning up ephemeral scraping_logs older than 2 days...');
  const logRes = await db.collection('scraping_logs').deleteMany({
    createdAt: { $lt: twoDaysAgo }
  });
  console.log(`✓ Deleted ${logRes.deletedCount} old scraping logs.`);

  // 2. Purge raw deal_channel_events older than 3 days
  console.log('2. Cleaning up deal_channel_events older than 3 days...');
  const eventRes = await db.collection('deal_channel_events').deleteMany({
    createdAt: { $lt: threeDaysAgo }
  });
  console.log(`✓ Deleted ${eventRes.deletedCount} old Telegram channel events.`);

  // 3. Purge stale verified_links cache older than 7 days
  console.log('3. Cleaning up stale verified_links older than 7 days...');
  const vlRes = await db.collection('verified_links').deleteMany({
    lastChecked: { $lt: sevenDaysAgo }
  });
  console.log(`✓ Deleted ${vlRes.deletedCount} stale verified_links.`);

  // 4. Purge expired deals older than 3 days
  console.log('4. Cleaning up expired deals older than 3 days...');
  const dealRes = await db.collection('deals').deleteMany({
    isExpired: true,
    createdAt: { $lt: threeDaysAgo }
  });
  console.log(`✓ Deleted ${dealRes.deletedCount} old expired deals.`);

  // 5. Compact oversized priceHistory arrays on products to 60 days
  console.log('5. Compacting oversized product priceHistory (>60 points) to 60-day rolling window...');
  const Products = db.collection('products');
  const cursor = Products.find({ 'priceHistory.60': { $exists: true } }, { projection: { _id: 1, priceHistory: 1 } });
  
  let compactedCount = 0;
  let bulkOps = [];
  const BATCH_SIZE = 500;

  for await (const prod of cursor) {
    if (Array.isArray(prod.priceHistory) && prod.priceHistory.length > 60) {
      const compactedPh = prod.priceHistory.slice(-60);
      bulkOps.push({
        updateOne: {
          filter: { _id: prod._id },
          update: { $set: { priceHistory: compactedPh } }
        }
      });

      if (bulkOps.length >= BATCH_SIZE) {
        await Products.bulkWrite(bulkOps, { ordered: false });
        compactedCount += bulkOps.length;
        process.stdout.write(`Compacted ${compactedCount} products...\r`);
        bulkOps = [];
      }
    }
  }

  if (bulkOps.length > 0) {
    await Products.bulkWrite(bulkOps, { ordered: false });
    compactedCount += bulkOps.length;
  }
  console.log(`\n✓ Successfully compacted priceHistory on ${compactedCount} products.`);

  // Final Stats
  const statsAfter = await db.stats();
  const dataSavedMB = ((statsBefore.dataSize - statsAfter.dataSize) / (1024 * 1024)).toFixed(2);
  console.log(`\n======================================================================`);
  console.log(`🎉 CLEANUP COMPLETE — RECLAIMED SPACE`);
  console.log(`======================================================================`);
  console.log(`New Data Size:        ${(statsAfter.dataSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`New Storage Size:     ${(statsAfter.storageSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Total Data Saved:     ${dataSavedMB} MB`);
  console.log(`Safe Free Headroom:   ${(512 - (statsAfter.dataSize / (1024 * 1024))).toFixed(2)} MB remaining in Free Tier`);
  console.log(`======================================================================\n`);

  await mongoose.disconnect();
}

runCleanup().catch(err => {
  console.error('Cleanup Error:', err);
  process.exit(1);
});
