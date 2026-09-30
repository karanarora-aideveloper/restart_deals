import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import {
  DEFAULT_SEEDS_BY_STORE,
  buildStoreSearchUrl,
  ensureCrawlerDefaults,
} from '../jobs/bestsellerCrawler.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/deals_db';

async function seedMultiStoreCrawler() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB successfully.');

  console.log('\n--- Seeding Multi-Store Keywords for Engine 2 ---');
  let totalAdded = 0;

  for (const [store, seedList] of Object.entries(DEFAULT_SEEDS_BY_STORE)) {
    console.log(`Checking seeds for store: ${store.toUpperCase()} (${seedList.length} configured default keywords)...`);
    let storeAdded = 0;

    for (const seed of seedList) {
      const searchUrl = buildStoreSearchUrl(store, seed.keywords);
      const res = await CrawlerSeed.updateOne(
        {
          store,
          category: seed.category,
          subcategory: seed.subcategory,
          keywords: seed.keywords,
        },
        {
          $setOnInsert: {
            store,
            category: seed.category,
            subcategory: seed.subcategory,
            keywords: seed.keywords,
            url: searchUrl,
            topN: 20,
            isEnabled: true,
            frequencyHours: 24,
          },
        },
        { upsert: true }
      );

      if (res.upsertedCount > 0) {
        storeAdded++;
        totalAdded++;
      }
    }

    const currentCount = await CrawlerSeed.countDocuments({ store });
    console.log(`  ✓ ${store.toUpperCase()}: ${storeAdded} newly inserted, ${currentCount} total seeds in DB.`);
  }

  const grandTotal = await CrawlerSeed.countDocuments({});
  console.log(`\nGrand Total Seeds in crawler_seeds: ${grandTotal} (newly added: ${totalAdded})`);

  const summary = await CrawlerSeed.aggregate([
    { $group: { _id: '$store', count: { $sum: 1 }, enabled: { $sum: { $cond: ['$isEnabled', 1, 0] } } } },
    { $sort: { count: -1 } },
  ]);

  console.log('\n--- Store Distribution Summary ---');
  console.table(summary.map(s => ({ Store: s._id, 'Total Seeds': s.count, 'Enabled Seeds': s.enabled })));

  await mongoose.disconnect();
  console.log('Done.');
}

seedMultiStoreCrawler().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
