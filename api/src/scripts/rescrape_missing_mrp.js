/**
 * rescrape_missing_mrp.js
 *
 * Fetches all Amazon products missing MRP from MongoDB and calls
 * POST /api/products/:id/refresh-live for each one via the running API server.
 *
 * Usage:
 *   cd api && node src/scripts/rescrape_missing_mrp.js
 *
 * Options (env vars):
 *   LIMIT=50          — max products to process (default 200)
 *   CONCURRENCY=2     — parallel requests at once (default 2)
 *   API_PORT=3001     — API server port (default 3001)
 *   DRY_RUN=1         — print products, don't call endpoint
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const LIMIT = parseInt(process.env.LIMIT || '200', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '2', 10);
const PORT = process.env.API_PORT || process.env.PORT || '3001';
const DRY_RUN = process.env.DRY_RUN === '1';
const BASE_URL = `http://localhost:${PORT}`;

async function refreshProduct(product, stats) {
  const id = product._id.toString();
  const title = product.title?.slice(0, 60) || id;
  const url = product.cleanUrl || '(no url)';

  if (!product.cleanUrl) {
    console.log(`  [SKIP] No cleanUrl: ${title}`);
    stats.skipped++;
    return;
  }

  if (DRY_RUN) {
    console.log(`  [DRY] ${title} — ${url}`);
    stats.dryRun++;
    return;
  }

  try {
    console.log(`  → ${title}`);
    const res = await fetch(`${BASE_URL}/api/products/${id}/refresh-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok && body.success) {
      const mrp = body.data?.originalPrice ?? body.product?.originalPrice ?? '?';
      const price = body.data?.price ?? body.product?.price ?? '?';
      console.log(`    ✓ price=₹${price}, MRP=₹${mrp}`);
      if (mrp && mrp !== '?' && mrp > 0) {
        stats.updated++;
      } else {
        stats.stillMissing++;
        console.log(`    ✗ MRP still null after refresh`);
      }
    } else {
      console.log(`    ✗ ${res.status}: ${body.error || JSON.stringify(body).slice(0, 100)}`);
      stats.failed++;
    }
  } catch (err) {
    console.log(`    ✗ Error: ${err.message}`);
    stats.failed++;
  }
}

async function processInBatches(products, stats) {
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const chunk = products.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((p) => refreshProduct(p, stats)));
    const done = Math.min(i + CONCURRENCY, products.length);
    console.log(`  [${done}/${products.length}] done\n`);
    if (done < products.length) {
      await new Promise((r) => setTimeout(r, 3000)); // pause between batches
    }
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const products = await Product.find(
    {
      merchant: 'amazon',
      isActive: { $ne: false },
      $or: [
        { originalPrice: { $exists: false } },
        { originalPrice: null },
        { originalPrice: 0 },
      ],
    },
    { _id: 1, title: 1, cleanUrl: 1, price: 1, originalPrice: 1 }
  )
    .sort({ lastChecked: 1 })
    .limit(LIMIT)
    .lean();

  console.log(`Found ${products.length} active Amazon products missing MRP (limit: ${LIMIT})`);
  if (DRY_RUN) console.log('[DRY RUN]\n');
  console.log(`API: ${BASE_URL} | Concurrency: ${CONCURRENCY}\n`);

  const stats = {
    total: products.length,
    updated: 0,
    stillMissing: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  await processInBatches(products, stats);

  console.log('\n=== Summary ===');
  console.log(`Total    : ${stats.total}`);
  if (DRY_RUN) {
    console.log(`DryRun   : ${stats.dryRun}`);
  } else {
    console.log(`Updated  : ${stats.updated}`);
    console.log(`Still ∅  : ${stats.stillMissing}`);
    console.log(`Failed   : ${stats.failed}`);
  }
  console.log(`Skipped  : ${stats.skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
