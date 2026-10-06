import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('[Error] MONGODB_URI not found in environment.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('shoppers_deals');
    const col = db.collection('deals');

    console.log('--- Starting Purge of Fake MRP Deals ---');
    const totalBefore = await col.countDocuments();
    console.log(`Total deals in DB before purge: ${totalBefore}`);

    // Criteria for KEEPING a deal:
    // 1. Must have a recorded previousPrice > dealPrice
    // 2. Drop must be >= 5% OR cash drop >= ₹50 (to eliminate trivial fluctuations)
    const keepFilter = {
      $expr: {
        $and: [
          { $gt: ['$previousPrice', '$dealPrice'] },
          { $gt: ['$previousPrice', 0] },
          {
            $or: [
              {
                $gte: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: ['$previousPrice', '$dealPrice'] },
                          '$previousPrice',
                        ],
                      },
                      100,
                    ],
                  },
                  5,
                ],
              },
              {
                $gte: [{ $subtract: ['$previousPrice', '$dealPrice'] }, 50],
              },
            ],
          },
        ],
      },
    };

    // 1. Identify real deals to keep
    const realDeals = await col.find(keepFilter).toArray();
    console.log(`Found ${realDeals.length} authentic price drop deals to KEEP.`);

    // 2. Identify and delete fake MRP deals
    const deleteResult = await col.deleteMany({
      _id: { $nin: realDeals.map((d) => d._id) },
    });
    console.log(`Successfully deleted ${deleteResult.deletedCount} fake MRP deals from deals collection.`);

    // 3. Normalize discountPercentage on remaining real deals to reflect TRUE PRICE DROP %
    console.log('Recalculating discountPercentage based on real price drops...');
    const bulkUpdates = realDeals.map((d) => {
      const realDropPct = Math.round(
        ((d.previousPrice - d.dealPrice) / d.previousPrice) * 100
      );
      return {
        updateOne: {
          filter: { _id: d._id },
          update: {
            $set: {
              discountPercentage: realDropPct,
              priceSource: 'price_history',
            },
          },
        },
      };
    });

    if (bulkUpdates.length > 0) {
      await col.bulkWrite(bulkUpdates);
      console.log(`Updated ${bulkUpdates.length} authentic deals with true price drop percentages.`);
    }

    const totalAfter = await col.countDocuments();
    console.log(`Total authentic deals in DB now: ${totalAfter}`);
    console.log('--- Purge Complete: All Deals Are Now 100% Verified Price Drops ---');
  } catch (err) {
    console.error('Error during purge:', err);
  } finally {
    await client.close();
  }
}

main();
