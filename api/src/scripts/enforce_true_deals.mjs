import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const dealsCol = db.collection('deals');

  console.log('1. Analyzing current deals collection...');
  const total = await dealsCol.countDocuments();
  console.log('Total documents in deals collection:', total);

  // 1. Purge all deals where previousPrice does not exist or previousPrice <= dealPrice
  const purgeResult = await dealsCol.updateMany(
    {
      $or: [
        { previousPrice: { $exists: false } },
        { previousPrice: null },
        { previousPrice: { $lte: 0 } },
        { $expr: { $lte: ['$previousPrice', '$dealPrice'] } }
      ]
    },
    {
      $set: {
        isExpired: true,
        expiredReason: 'no_historical_price_drop',
        isVerified: false,
        updatedAt: new Date()
      }
    }
  );
  console.log(`✓ Expired ${purgeResult.modifiedCount} fake MRP deals (no verified price drop against history).`);

  // 2. For all genuine deals with previousPrice > dealPrice:
  // Recompute discountPercentage strictly as (previousPrice - dealPrice) / previousPrice * 100
  const realDeals = await dealsCol.find({
    previousPrice: { $gt: 0 },
    $expr: { $gt: ['$previousPrice', '$dealPrice'] }
  }).toArray();

  console.log(`2. Recalculating true discount percentages for ${realDeals.length} authentic price drop deals...`);
  const bulkOps = [];
  for (const deal of realDeals) {
    const prev = Number(deal.previousPrice);
    const curr = Number(deal.dealPrice);
    const realDropCash = prev - curr;
    const realDropPct = Math.round((realDropCash / prev) * 100);

    // If drop is negligible (0%) or extreme (>85% anomaly), mark expired
    if (realDropPct <= 0 || realDropPct > 85) {
      bulkOps.push({
        updateOne: {
          filter: { _id: deal._id },
          update: {
            $set: {
              isExpired: true,
              expiredReason: realDropPct <= 0 ? 'zero_drop' : 'extreme_anomaly',
              isVerified: false,
              discountPercentage: realDropPct,
              updatedAt: new Date()
            }
          }
        }
      });
    } else {
      bulkOps.push({
        updateOne: {
          filter: { _id: deal._id },
          update: {
            $set: {
              isExpired: false,
              isVerified: true,
              priceSource: 'price_history',
              discountPercentage: realDropPct,
              updatedAt: new Date()
            }
          }
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await dealsCol.bulkWrite(bulkOps, { ordered: false });
  }

  const activeTrueDeals = await dealsCol.countDocuments({
    isExpired: { $ne: true },
    isVerified: true,
    previousPrice: { $gt: 0 },
    $expr: { $gt: ['$previousPrice', '$dealPrice'] }
  });

  console.log(`✓ Completed! Active verified true deals in database: ${activeTrueDeals}`);
  await mongoose.disconnect();
}

run().catch(console.error);
