import cron from 'node-cron';
import mongoose from 'mongoose';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';

let isCompactorRunning = false;

/**
 * Storage Compactor & Pruning Job
 * 
 * Enforces ShoppersDeals MongoDB Atlas Free Tier Optimization (<512MB limit):
 * 1. Rolling 60-day priceHistory compaction on products (prevents 40KB document bloat).
 * 2. Purges stale expired deals older than 3 days.
 * 3. Prunes stale verified_links cache older than 7 days.
 */
export async function runStorageCompaction() {
  if (isCompactorRunning) {
    console.log('[StorageCompactor] Previous compaction still running. Skipping.');
    return { skipped: true };
  }

  isCompactorRunning = true;
  const startTime = Date.now();
  console.log('[StorageCompactor] 🧹 Starting automated database storage compaction...');

  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[StorageCompactor] No active DB connection.');
      return { skipped: true, reason: 'no_db' };
    }

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Purge stale expired deals older than 3 days
    const dealRes = await Deal.deleteMany({
      isExpired: true,
      createdAt: { $lt: threeDaysAgo },
    }).catch(err => {
      console.warn('[StorageCompactor] Deal prune error:', err.message);
      return { deletedCount: 0 };
    });

    // 2. Purge stale verified_links older than 3 days or missing lastChecked
    const vlRes = await db.collection('verified_links').deleteMany({
      $or: [
        { lastChecked: { $lt: threeDaysAgo } },
        { lastChecked: null },
        { lastChecked: { $exists: false } },
      ],
    }).catch(err => {
      console.warn('[StorageCompactor] VerifiedLink prune error:', err.message);
      return { deletedCount: 0 };
    });

    // 2b. Strip bulky unused fields (aboutThisItem, technicalSpecifications) from remaining verified_links
    await db.collection('verified_links').updateMany(
      { $or: [{ aboutThisItem: { $exists: true } }, { technicalSpecifications: { $exists: true } }] },
      { $unset: { aboutThisItem: '', technicalSpecifications: '' } }
    ).catch(() => {});

    // 2c. Purge stale deal_channel_events older than 3 days
    await db.collection('deal_channel_events').deleteMany({
      createdAt: { $lt: threeDaysAgo },
    }).catch(() => {});

    // 3. Compact products with priceHistory > 60 items
    const cursor = Product.find(
      { 'priceHistory.60': { $exists: true } },
      { _id: 1, priceHistory: 1 }
    ).lean();

    let compactedCount = 0;
    let bulkOps = [];
    const BATCH_SIZE = 500;

    for await (const prod of cursor) {
      if (Array.isArray(prod.priceHistory) && prod.priceHistory.length > 60) {
        bulkOps.push({
          updateOne: {
            filter: { _id: prod._id },
            update: { $set: { priceHistory: prod.priceHistory.slice(-60) } },
          },
        });

        if (bulkOps.length >= BATCH_SIZE) {
          await Product.bulkWrite(bulkOps, { ordered: false });
          compactedCount += bulkOps.length;
          bulkOps = [];
        }
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { ordered: false });
      compactedCount += bulkOps.length;
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[StorageCompactor] ✓ Compaction complete in ${durationSec}s:`);
    console.log(`  • Compacted products: ${compactedCount}`);
    console.log(`  • Purged expired deals: ${dealRes.deletedCount}`);
    console.log(`  • Purged stale links: ${vlRes.deletedCount}`);

    return {
      success: true,
      durationSec,
      compactedCount,
      purgedDeals: dealRes.deletedCount,
      purgedLinks: vlRes.deletedCount,
    };
  } catch (err) {
    console.error('[StorageCompactor] Error during compaction:', err.message);
    return { success: false, error: err.message };
  } finally {
    isCompactorRunning = false;
  }
}

/**
 * Initializes the recurring Storage Compactor Cron Job
 * Runs daily at 03:30 AM IST (22:00 UTC)
 */
export function startStorageCompactorScheduler() {
  console.log('[StorageCompactor] Scheduling daily database storage compactor (03:30 AM IST)...');

  cron.schedule('0 22 * * *', async () => {
    await runStorageCompaction();
  });

  // Optional: run a single light compaction 2 minutes after startup
  setTimeout(async () => {
    try {
      await runStorageCompaction();
    } catch (err) {
      console.warn('[StorageCompactor Startup Error]:', err.message);
    }
  }, 120_000);
}
