import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

import { classifySourceEngine } from '../src/utils/engineClassifier.js';

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('[Migration] 1. Updating hasPriceHistory on products collection...');
  // Products with at least 2 checkpoints in priceHistory
  const resTrue = await db.collection('products').updateMany(
    { 'priceHistory.1': { $exists: true } },
    { $set: { hasPriceHistory: true } }
  );
  console.log(`[Migration] Set hasPriceHistory = true on ${resTrue.modifiedCount} products (matched: ${resTrue.matchedCount})`);

  // Products with fewer than 2 checkpoints
  const resFalse = await db.collection('products').updateMany(
    {
      $or: [
        { 'priceHistory.1': { $exists: false } },
        { priceHistory: { $exists: false } },
        { priceHistory: null }
      ]
    },
    { $set: { hasPriceHistory: false } }
  );
  console.log(`[Migration] Set hasPriceHistory = false on ${resFalse.modifiedCount} products (matched: ${resFalse.matchedCount})`);

  // Create index on products
  console.log('[Migration] Creating index on products.hasPriceHistory...');
  await db.collection('products').createIndex({ hasPriceHistory: 1 });

  console.log('\n[Migration] 2. Updating sourceEngine and hasPriceHistory on deals collection...');
  const deals = await db.collection('deals').find({}).project({ _id: 1, sourceChannelId: 1, sourceChannelName: 1, productId: 1, previousPrice: 1 }).toArray();
  console.log(`[Migration] Found ${deals.length} total deals to process.`);

  // Build a lookup set of productIds with price history for rapid mapping
  const prodsWithHistory = new Set(
    (await db.collection('products').find({ hasPriceHistory: true }).project({ productId: 1 }).toArray())
      .map(p => p.productId)
      .filter(Boolean)
  );
  console.log(`[Migration] Indexed ${prodsWithHistory.size} products with verified price history.`);

  let engine1Count = 0;
  let engine2Count = 0;
  let historyCount = 0;

  const bulkOps = [];
  for (const deal of deals) {
    const engine = classifySourceEngine(deal.sourceChannelId, deal.sourceChannelName);
    if (engine === 'engine2') engine2Count++;
    else engine1Count++;

    const hasHistory = Boolean(
      (deal.productId && prodsWithHistory.has(deal.productId)) ||
      (deal.previousPrice && deal.previousPrice > 0)
    );
    if (hasHistory) historyCount++;

    bulkOps.push({
      updateOne: {
        filter: { _id: deal._id },
        update: {
          $set: {
            sourceEngine: engine,
            hasPriceHistory: hasHistory
          }
        }
      }
    });

    if (bulkOps.length >= 1000) {
      await db.collection('deals').bulkWrite(bulkOps);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await db.collection('deals').bulkWrite(bulkOps);
  }

  console.log(`[Migration] Deals updated:
    • Engine 1 (Telegram Radar) : ${engine1Count}
    • Engine 2 (Store Watcher)  : ${engine2Count}
    • Deals with Price History  : ${historyCount}
  `);

  // Create indexes on deals
  console.log('[Migration] Creating indexes on deals.sourceEngine and deals.hasPriceHistory...');
  await db.collection('deals').createIndex({ sourceEngine: 1 });
  await db.collection('deals').createIndex({ hasPriceHistory: 1 });

  console.log('[Migration] ✅ Migration completed successfully!');
  await mongoose.disconnect();
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
