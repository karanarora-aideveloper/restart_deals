import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function runBackfill() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log('[Backfill] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[Backfill] Connected successfully.');

  const productsCol = mongoose.connection.collection('products');
  const dealsCol = mongoose.connection.collection('deals');

  let totalInspected = 0;
  let totalWithHistory = 0;
  let updatedProductsCount = 0;
  let genuineDropsCount = 0;

  const productPreviousPriceMap = new Map(); // productId -> previousPrice
  let lastId = null;
  const CHUNK_SIZE = 1000;

  console.log('[Backfill] Processing products in indexed _id batches...');
  console.time('totalProductProcessing');

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const batch = await productsCol
      .find(query)
      .sort({ _id: 1 })
      .limit(CHUNK_SIZE)
      .project({ _id: 1, productId: 1, price: 1, originalPrice: 1, previousPrice: 1, priceHistory: 1 })
      .toArray();

    if (!batch || batch.length === 0) break;
    lastId = batch[batch.length - 1]._id;
    totalInspected += batch.length;

    const bulkOps = [];

    for (const product of batch) {
      const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];
      if (history.length === 0) continue;
      totalWithHistory++;

      // Filter valid numbers and sort chronologically
      const sorted = [...history]
        .filter((h) => h && h.price != null && !isNaN(Number(h.price)) && Number(h.price) > 0)
        .sort((a, b) => new Date(a.timestamp || a.date || 0) - new Date(b.timestamp || b.date || 0));

      if (sorted.length === 0) continue;

      const currentPrice = Number(product.price) || Number(sorted[sorted.length - 1].price);

      // Scan backwards from the end of history to find the last distinct selling price before currentPrice
      let previousDistinctPrice = null;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const p = Number(sorted[i].price);
        if (p !== currentPrice) {
          previousDistinctPrice = p;
          break;
        }
      }

      if (previousDistinctPrice != null) {
        if (product.productId) {
          productPreviousPriceMap.set(product.productId, previousDistinctPrice);
        }

        if (previousDistinctPrice > currentPrice) {
          genuineDropsCount++;
        }

        // If product.previousPrice isn't set or differs, schedule update
        if (product.previousPrice !== previousDistinctPrice) {
          bulkOps.push({
            updateOne: {
              filter: { _id: product._id },
              update: {
                $set: {
                  previousPrice: previousDistinctPrice,
                  priceUpdatedAt: new Date(),
                }
              }
            }
          });
          updatedProductsCount++;
        }
      }
    }

    if (bulkOps.length > 0) {
      await productsCol.bulkWrite(bulkOps);
    }

    console.log(`[Backfill] Processed ${totalInspected} products (updated: ${updatedProductsCount}, genuine drops: ${genuineDropsCount})...`);
  }

  console.timeEnd('totalProductProcessing');
  console.log(`[Backfill] ✅ Finished products processing!`);
  console.log(`- Total products inspected: ${totalInspected}`);
  console.log(`- Products with priceHistory: ${totalWithHistory}`);
  console.log(`- Products with distinct previous prices: ${productPreviousPriceMap.size}`);
  console.log(`- Products with genuine drops (previousPrice > currentPrice): ${genuineDropsCount}`);
  console.log(`- Product records updated in DB: ${updatedProductsCount}`);

  // Now backfill deals
  console.log(`[Backfill] Processing active deals in indexed batches...`);
  console.time('totalDealProcessing');
  let lastDealId = null;
  let dealsInspected = 0;
  let dealsUpdated = 0;
  let dealDropsFound = 0;

  while (true) {
    const dealQuery = lastDealId
      ? { _id: { $gt: lastDealId }, isExpired: { $ne: true } }
      : { isExpired: { $ne: true } };

    const dealBatch = await dealsCol
      .find(dealQuery)
      .sort({ _id: 1 })
      .limit(CHUNK_SIZE)
      .project({ _id: 1, productId: 1, dealPrice: 1, originalPrice: 1, previousPrice: 1, priceSource: 1 })
      .toArray();

    if (!dealBatch || dealBatch.length === 0) break;
    lastDealId = dealBatch[dealBatch.length - 1]._id;
    dealsInspected += dealBatch.length;

    const dealBulkOps = [];

    for (const deal of dealBatch) {
      if (!deal.productId) continue;
      const prevPrice = productPreviousPriceMap.get(deal.productId);

      if (prevPrice != null && prevPrice !== deal.previousPrice) {
        const isDrop = prevPrice > (Number(deal.dealPrice) || 0);
        if (isDrop) dealDropsFound++;

        dealBulkOps.push({
          updateOne: {
            filter: { _id: deal._id },
            update: {
              $set: {
                previousPrice: prevPrice,
                ...(isDrop && deal.priceSource !== 'price_history' ? { priceSource: 'price_history' } : {})
              }
            }
          }
        });
        dealsUpdated++;
      }
    }

    if (dealBulkOps.length > 0) {
      await dealsCol.bulkWrite(dealBulkOps);
    }
  }

  console.timeEnd('totalDealProcessing');
  console.log(`[Backfill] ✅ Finished deals processing!`);
  console.log(`- Active deals inspected: ${dealsInspected}`);
  console.log(`- Deals updated with authentic previousPrice: ${dealsUpdated}`);
  console.log(`- Deals with genuine price drops: ${dealDropsFound}`);

  await mongoose.disconnect();
  console.log('[Backfill] Database disconnected cleanly.');
}

runBackfill().catch((err) => {
  console.error('[Backfill Error]', err);
  process.exit(1);
});
